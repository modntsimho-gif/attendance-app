"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, XCircle, FileText, User, Calendar, ChevronRight, Loader2, AlertCircle } from "lucide-react";
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
  status: string;
  rawData: any;
  
  // [NEW] 공휴일/휴일 여부 식별자
  isHoliday?: boolean; 
}

export default function ApprovalModal({ isOpen, onClose }: ApprovalModalProps) {
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

      const { data: lines, error: lineError } = await supabase
        .from("approval_lines")
        .select("*")
        .eq("approver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (lineError || !lines || lines.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const formattedRequests: ApprovalRequest[] = [];

      for (const line of lines) {
        let details: any = null;
        let applicantId: string = "";
        let type: "leave" | "overtime" = "leave";

        // 1. 휴가 신청서 조회
        if (line.leave_request_id) {
          type = "leave";
          const { data: leaveData } = await supabase
            .from("leave_requests")
            .select("*")
            .eq("id", line.leave_request_id)
            .maybeSingle();
          
          if (leaveData) {
            details = leaveData;
            applicantId = leaveData.user_id;
          }
        } 
        // 2. 초과근무 신청서 조회
        else if (line.overtime_request_id) {
          type = "overtime";
          const { data: overtimeData } = await supabase
            .from("overtime_requests")
            .select("*")
            .eq("id", line.overtime_request_id)
            .maybeSingle();

          if (overtimeData) {
            details = overtimeData;
            applicantId = overtimeData.user_id;
          }
        }

        // 3. 신청자 프로필 조회
        let applicantName = "알수없음";
        let applicantRole = "직원";

        if (applicantId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, position")
            .eq("id", applicantId)
            .maybeSingle();
          
          if (profile) {
            applicantName = profile.name;
            applicantRole = profile.position || "직원";
          }
        }

        // 4. 데이터 포맷팅
        if (details) {
          const reqDate = new Date(details.created_at).toLocaleDateString();
          
          let timeRangeStr = "";
          let durationDisplay = ""; 
          let isHolidayWork = false; // [NEW] 휴일 여부 체크

          if (type === "leave") {
             timeRangeStr = details.start_time 
              ? `${details.start_time.slice(0,5)} ~ ${details.end_time?.slice(0,5)}` 
              : "종일";
             
             const days = details.total_leave_days ?? calculateLeaveDaysFallback(details.start_date, details.end_date, details.leave_type);
             durationDisplay = `${days}일`;

          } else {
             // [Overtime]
             timeRangeStr = `${details.start_time?.slice(0,5)} ~ ${details.end_time?.slice(0,5)}`;
             
             const hours = details.total_hours || 0;
             const days = details.recognized_days || 0; 
             
             durationDisplay = `${hours}시간`;
             if (days > 0) {
               durationDisplay += ` (${days}일 보상)`;
             }

             // [NEW] DB에 is_holiday 컬럼이 있다고 가정하고 매핑
             // (만약 컬럼명이 다르다면 details.holiday_work 등으로 수정 필요)
             isHolidayWork = !!details.is_holiday; 
          }

          formattedRequests.push({
            id: line.id,
            requestId: details.id,
            applicant: applicantName,
            role: applicantRole,
            type: type,
            category: type === "leave" ? details.leave_type : "초과근무",
            date: type === "leave" 
              ? `${details.start_date} ~ ${details.end_date}` 
              : details.work_date,
            timeRange: timeRangeStr,
            duration: durationDisplay,
            hours: type === "overtime" ? Number(details.total_hours || 0) : undefined,
            reason: details.reason || "-",
            handover: details.handover_notes || "-",
            requestDate: reqDate,
            status: line.status,
            rawData: details,
            isHoliday: isHolidayWork // [NEW] 저장
          });
        }
      }

      setRequests(formattedRequests);
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

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
        console.error("결재 처리 실패:", error);
        throw error;
      }

      alert(status === "approved" ? "승인 처리되었습니다." : "반려 처리되었습니다.");
      
      fetchApprovals();
      if (selectedRequest?.id === item.id) setSelectedRequest(null);
      router.refresh();

    } catch (e) {
      console.error("에러 발생:", e);
      alert("처리 중 오류가 발생했습니다. 관리자에게 문의하세요.");
    }
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
                결재 대기 문서함
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                승인 대기 중인 문서가 <span className="text-yellow-400 font-bold">{requests.length}건</span> 있습니다.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 탭 메뉴 */}
          <div className="px-6 pt-4 pb-0 border-b border-gray-200 bg-gray-50">
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
                      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col md:flex-row gap-5 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group relative"
                    >
                      <div className="absolute top-3 right-3 text-gray-300 group-hover:text-blue-500 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>

                      <div className="flex items-start gap-3 md:w-[180px] md:border-r md:border-gray-100 md:pr-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{item.applicant}</div>
                          <div className="text-xs text-gray-500">{item.role}</div>
                          <div className="text-[10px] text-gray-400 mt-1">{item.requestDate}</div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* [기존] 카테고리 배지 */}
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border flex-shrink-0 ${
                            item.type === 'leave' 
                              ? 'bg-blue-50 text-blue-600 border-blue-100' 
                              : 'bg-purple-50 text-purple-600 border-purple-100'
                          }`}>
                            {item.category}
                          </span>

                          {/* [NEW] 휴일 근무 배지 (빨간색) */}
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

                      <div className="flex md:flex-col gap-2 justify-center md:border-l md:border-gray-100 md:pl-4 min-w-[100px]">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleProcess(item, "approved"); 
                          }}
                          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-bold transition-colors shadow-sm"
                        >
                          <Check className="w-4 h-4" /> 승인
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleProcess(item, "rejected"); 
                          }}
                          className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> 반려
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Check className="w-12 h-12 text-gray-300 mb-3" />
                    <p>처리할 결재 문서가 없습니다.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedRequest?.type === 'leave' && (
        <LeaveApplicationModal 
          isOpen={!!selectedRequest} 
          onClose={() => setSelectedRequest(null)} 
          initialData={selectedRequest.rawData} 
        />
      )}

      {selectedRequest?.type === 'overtime' && (
        <OvertimeApplicationModal 
          isOpen={!!selectedRequest} 
          onClose={() => setSelectedRequest(null)} 
          initialData={selectedRequest.rawData} 
        />
      )}
    </>
  );
}
