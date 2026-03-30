"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, XCircle, FileText, User, Calendar, ChevronRight, Loader2, AlertCircle, FileInput, FilePenLine, FileX2, History, CheckCircle2, Clock, Send } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

import LeaveApplicationModal from "./LeaveApplicationModal";
import OvertimeApplicationModal from "./OvertimeApplicationModal";

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ApprovalRequest {
  id: string;             
  requestId: string;      
  applicant: string;      
  role: string;           
  type: "leave" | "overtime";
  category: string;       
  date: string;           
  timeRange: string;      
  duration: string;       
  hours?: number;         
  reason: string;
  handover?: string;
  requestDate: string;
  createdAt: string; // 정렬용 원본 날짜
  status: string;
  rawData: any;
  
  isHoliday?: boolean;
  requestType: string;
  processedAt?: string;
}

export default function ApprovalModal({ isOpen, onClose }: ApprovalModalProps) {
  // ⭐️ [NEW] 뷰 모드에 "my_requests"(내 기안함) 추가
  const [viewMode, setViewMode] = useState<"pending" | "history" | "my_requests">("pending");
  
  const [activeTab, setActiveTab] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  const calculateLeaveDaysFallback = (start: string, end: string, type: string) => {
    if (type.includes('반차')) return 0.5;
    if (type.includes('반반')) return 0.25;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  };

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let leaves: any[] = [];
      let overtimes: any[] = [];
      let lines: any[] = [];

      // ⭐️ [NEW] 내가 올린 결재(기안함) 조회 로직
      if (viewMode === "my_requests") {
        const [leaveRes, overtimeRes] = await Promise.all([
          supabase.from("leave_requests").select("*").eq("user_id", user.id),
          supabase.from("overtime_requests").select("*").eq("user_id", user.id)
        ]);

        leaves = leaveRes.data || [];
        overtimes = overtimeRes.data || [];

        const leaveIds = leaves.map(l => l.id);
        const overtimeIds = overtimes.map(o => o.id);

        // 내 기안문서들의 결재선(상태) 가져오기
        const linePromises = [];
        if (leaveIds.length > 0) {
          linePromises.push(supabase.from("approval_lines").select("*").in("leave_request_id", leaveIds));
        }
        if (overtimeIds.length > 0) {
          linePromises.push(supabase.from("approval_lines").select("*").in("overtime_request_id", overtimeIds));
        }

        const lineResults = await Promise.all(linePromises);
        lines = lineResults.flatMap(res => res.data || []);

      } 
      // 기존 로직: 결재 수신함 (대기/내역)
      else {
        let query = supabase
          .from("approval_lines")
          .select("*")
          .eq("approver_id", user.id)
          .order(viewMode === "pending" ? "created_at" : "updated_at", { ascending: false, nullsFirst: false });

        if (viewMode === "pending") {
          query = query.eq("status", "pending");
        } else {
          query = query.in("status", ["approved", "rejected"]);
        }

        const { data: fetchedLines, error: lineError } = await query;

        if (lineError || !fetchedLines || fetchedLines.length === 0) {
          setRequests([]);
          setLoading(false);
          return;
        }
        lines = fetchedLines;

        const leaveIds = lines.map(l => l.leave_request_id).filter(Boolean);
        const overtimeIds = lines.map(l => l.overtime_request_id).filter(Boolean);

        const [leaveRes, overtimeRes] = await Promise.all([
          leaveIds.length > 0 ? supabase.from("leave_requests").select("*").in("id", leaveIds) : Promise.resolve({ data: [] }),
          overtimeIds.length > 0 ? supabase.from("overtime_requests").select("*").in("id", overtimeIds) : Promise.resolve({ data: [] })
        ]);

        leaves = leaveRes.data || [];
        overtimes = overtimeRes.data || [];
      }

      // 작성자 프로필 가져오기
      const userIds = [...new Set([
        ...leaves.map(l => l.user_id),
        ...overtimes.map(o => o.user_id)
      ])];

      const { data: profiles } = userIds.length > 0 
        ? await supabase.from("profiles").select("id, name, position").in("id", userIds)
        : { data: [] };

      // 데이터 매핑
      let formattedRequests: ApprovalRequest[] = lines.map(line => {
        let details = null;
        let type: "leave" | "overtime" = "leave";

        if (line.leave_request_id) {
          type = "leave";
          details = leaves.find(l => l.id === line.leave_request_id);
        } else if (line.overtime_request_id) {
          type = "overtime";
          details = overtimes.find(o => o.id === line.overtime_request_id);
        }

        if (!details) return null;

        const profile = profiles?.find(p => p.id === details.user_id);
        const applicantName = profile?.name || "알수없음";
        const applicantRole = profile?.position || "직원";

        const reqDate = new Date(details.created_at).toLocaleDateString();
        const processedDate = line.updated_at ? new Date(line.updated_at).toLocaleDateString() : undefined;
        
        let timeRangeStr = "";
        let durationDisplay = ""; 
        let isHolidayWork = false;

        if (type === "leave") {
           timeRangeStr = details.start_time 
            ? `${details.start_time.slice(0,5)} ~ ${details.end_time?.slice(0,5)}` 
            : "종일";
           
           const days = details.total_leave_days ?? calculateLeaveDaysFallback(details.start_date, details.end_date, details.leave_type);
           durationDisplay = `${days}일`;
        } else {
           timeRangeStr = `${details.start_time?.slice(0,5)} ~ ${details.end_time?.slice(0,5)}`;
           const hours = details.total_hours || 0;
           const days = details.recognized_days || 0; 
           
           durationDisplay = `${hours}시간`;
           if (days > 0) durationDisplay += ` (${days}일 보상)`;
           isHolidayWork = !!details.is_holiday; 
        }

        return {
          id: line.id,
          requestId: details.id,
          applicant: applicantName,
          role: applicantRole,
          type: type,
          category: type === "leave" ? details.leave_type : "초과근무",
          date: type === "leave" ? `${details.start_date} ~ ${details.end_date}` : details.work_date,
          timeRange: timeRangeStr,
          duration: durationDisplay,
          hours: type === "overtime" ? Number(details.total_hours || 0) : undefined,
          reason: details.reason || "-",
          handover: details.handover_notes || "-",
          requestDate: reqDate,
          createdAt: details.created_at,
          status: line.status,
          rawData: details,
          isHoliday: isHolidayWork,
          requestType: details.request_type || "create",
          processedAt: processedDate
        };
      }).filter(Boolean) as ApprovalRequest[];

      // 내 기안함일 경우 최신 신청순으로 정렬
      if (viewMode === "my_requests") {
        formattedRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      setRequests(formattedRequests);
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, viewMode]);

  useEffect(() => {
    if (isOpen) {
      fetchApprovals();
    }
  }, [isOpen, fetchApprovals]);

  const handleProcess = async (item: ApprovalRequest, status: "approved" | "rejected") => {
    if (!confirm(status === "approved" ? "정말 승인하시겠습니까?" : "정말 반려하시겠습니까?")) return;

    try {
      const { error } = await supabase.rpc("process_approval_decision", {
        p_line_id: item.id,      
        p_status: status,        
        p_amount: 0 
      });

      if (error) {
        alert(`처리 실패: ${error.message || "알 수 없는 오류"}`);
        return; 
      }

      alert(status === "approved" ? "승인 처리되었습니다." : "반려 처리되었습니다.");
      fetchApprovals();
      if (selectedRequest?.id === item.id) setSelectedRequest(null);
      router.refresh();
    } catch (e: any) {
      alert(`시스템 오류: ${e.message}`);
    }
  };

  const renderRequestTypeBadge = (type: string) => {
    switch (type) {
      case 'update':
        return <span className="px-2 py-0.5 rounded text-xs font-bold border bg-orange-50 text-orange-600 border-orange-100 flex items-center gap-1"><FilePenLine className="w-3 h-3" /> 변경</span>;
      case 'cancel':
        return <span className="px-2 py-0.5 rounded text-xs font-bold border bg-red-50 text-red-600 border-red-100 flex items-center gap-1"><FileX2 className="w-3 h-3" /> 취소</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold border bg-green-50 text-green-600 border-green-100 flex items-center gap-1"><FileInput className="w-3 h-3" /> 신청</span>;
    }
  };

  const getHeaderDescription = () => {
    if (viewMode === 'pending') return '승인 대기 중인 문서가';
    if (viewMode === 'history') return '내가 처리한 문서가';
    return '내가 기안한 문서가';
  };

  if (!isOpen) return null;

  const filteredData = requests.filter(item => {
    if (activeTab === "all") return true;
    return item.type === activeTab;
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          
          {/* 헤더 */}
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-800 text-white">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-yellow-400" />
                결재 문서함
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {getHeaderDescription()} <span className="text-yellow-400 font-bold">{requests.length}건</span> 있습니다.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* ⭐️ [NEW] 상위 탭 (대기 / 내역 / 내 기안함) */}
          <div className="px-6 pt-4 bg-white border-b border-gray-100">
             <div className="flex p-1 bg-gray-100 rounded-lg w-full md:w-fit mb-4">
                <button 
                  onClick={() => setViewMode("pending")}
                  className={`flex-1 md:flex-none px-5 py-1.5 rounded-md text-sm font-bold transition-all ${
                    viewMode === "pending" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  결재 대기
                </button>
                <button 
                  onClick={() => setViewMode("history")}
                  className={`flex-1 md:flex-none px-5 py-1.5 rounded-md text-sm font-bold transition-all ${
                    viewMode === "history" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  결재 내역
                </button>
                <button 
                  onClick={() => setViewMode("my_requests")}
                  className={`flex-1 md:flex-none px-5 py-1.5 rounded-md text-sm font-bold transition-all ${
                    viewMode === "my_requests" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  내 기안함
                </button>
             </div>

             {/* 하위 탭 (전체 / 휴가 / 초과근무) */}
             <div className="flex gap-6">
              <button onClick={() => setActiveTab("all")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'all' ? 'border-gray-800 text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>전체</button>
              <button onClick={() => setActiveTab("leave")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'leave' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>휴가 신청</button>
              <button onClick={() => setActiveTab("overtime")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overtime' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>초과 근무</button>
            </div>
          </div>

          {/* 리스트 영역 */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-100/50">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <p className="text-gray-500 text-sm">문서를 불러오는 중...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredData.length > 0 ? (
                  filteredData.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedRequest(item)}
                      className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col md:flex-row gap-5 transition-all cursor-pointer group relative ${
                        viewMode !== 'pending' ? 'border-gray-200 opacity-90 hover:opacity-100' : 'border-gray-200 hover:border-blue-400 hover:shadow-md'
                      }`}
                    >
                      <div className="absolute top-3 right-3 text-gray-300 group-hover:text-blue-500 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>

                      <div className="flex items-start gap-3 md:w-[180px] md:border-r md:border-gray-100 md:pr-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          viewMode !== 'pending' ? 'bg-gray-50 text-gray-400' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className={`font-bold transition-colors ${
                            viewMode !== 'pending' ? 'text-gray-600' : 'text-gray-800 group-hover:text-blue-700'
                          }`}>
                            {item.applicant}
                          </div>
                          <div className="text-xs text-gray-500">{item.role}</div>
                          <div className="text-[10px] text-gray-400 mt-1">{item.requestDate} 신청</div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {renderRequestTypeBadge(item.requestType)}

                          <span className={`px-2 py-0.5 rounded text-xs font-bold border flex-shrink-0 ${
                            item.type === 'leave' 
                              ? 'bg-blue-50 text-blue-600 border-blue-100' 
                              : 'bg-purple-50 text-purple-600 border-purple-100'
                          }`}>
                            {item.category}
                          </span>

                          {item.isHoliday && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold border flex-shrink-0 bg-red-50 text-red-600 border-red-100 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              휴일근무
                            </span>
                          )}

                          <span className="text-sm font-bold text-gray-800 flex items-center gap-1 truncate ml-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {item.date}
                          </span>
                        </div>

                        <div className="text-sm text-gray-600">
                           <div className="flex items-center gap-2">
                              <span className="font-medium text-xs text-gray-500">
                                {item.type === 'leave' ? '기간:' : '시간:'}
                              </span>
                              <span className="font-bold text-gray-700">
                                {item.duration}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({item.timeRange})
                              </span>
                            </div>
                        </div>

                        <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded mt-2 truncate">
                          <span className="font-bold text-gray-400 text-xs mr-2">사유</span>
                          {item.reason}
                        </div>
                      </div>

                      {/* 우측 영역: 대기(버튼) vs 내역/기안함(상태 뱃지) */}
                      <div className="flex md:flex-col gap-2 justify-center md:border-l md:border-gray-100 md:pl-4 min-w-[100px]">
                        {viewMode === "pending" ? (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleProcess(item, "approved"); }}
                              className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-bold transition-colors shadow-sm"
                            >
                              <Check className="w-4 h-4" /> 승인
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleProcess(item, "rejected"); }}
                              className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                            >
                              <XCircle className="w-4 h-4" /> 반려
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-1">
                            {item.status === "approved" ? (
                              <div className="flex flex-col items-center text-blue-600">
                                <CheckCircle2 className="w-6 h-6 mb-1" />
                                <span className="text-xs font-bold">승인됨</span>
                              </div>
                            ) : item.status === "rejected" ? (
                              <div className="flex flex-col items-center text-red-500">
                                <XCircle className="w-6 h-6 mb-1" />
                                <span className="text-xs font-bold">반려됨</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-gray-500">
                                <Clock className="w-6 h-6 mb-1" />
                                <span className="text-xs font-bold">진행중</span>
                              </div>
                            )}
                            {item.processedAt && (
                              <div className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-1">
                                 <Clock className="w-3 h-3" />
                                 {item.processedAt}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    {viewMode === 'pending' ? (
                        <><Check className="w-12 h-12 text-gray-300 mb-3" /><p>처리할 결재 문서가 없습니다.</p></>
                    ) : viewMode === 'history' ? (
                        <><History className="w-12 h-12 text-gray-300 mb-3" /><p>처리된 결재 내역이 없습니다.</p></>
                    ) : (
                        <><Send className="w-12 h-12 text-gray-300 mb-3" /><p>내가 기안한 문서가 없습니다.</p></>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedRequest?.type === 'leave' && (
        <LeaveApplicationModal isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} initialData={selectedRequest.rawData} />
      )}

      {selectedRequest?.type === 'overtime' && (
        <OvertimeApplicationModal isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} initialData={selectedRequest.rawData} />
      )}
    </>
  );
}
