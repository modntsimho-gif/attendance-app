"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, XCircle, FileText, User, Calendar, ChevronRight, Loader2, AlertCircle, FileInput, FilePenLine, FileX2, History, CheckCircle2, Clock, Send } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import LeaveApplicationModal from "./LeaveApplicationModal";
import OvertimeApplicationModal from "./OvertimeApplicationModal";

interface ApprovalModalProps { isOpen: boolean; onClose: () => void; }
interface ApprovalRequest {
  id: string; requestId: string; applicant: string; role: string;
  type: "leave" | "overtime"; category: string; date: string; timeRange: string;
  duration: string; hours?: number; reason: string; handover?: string;
  requestDate: string; createdAt: string; status: string; rawData: any;
  isHoliday?: boolean; requestType: string; processedAt?: string;
}

// 탭 및 상태별 UI 상수화 (중복 제거용)
const VIEW_MODES = [
  { id: "pending", label: "결재 대기" },
  { id: "history", label: "결재 내역" },
  { id: "my_requests", label: "내 기안함" }
] as const;

const TYPE_TABS = [
  { id: "all", label: "전체", color: "gray-800", border: "border-gray-800" },
  { id: "leave", label: "휴가 신청", color: "blue-600", border: "border-blue-600" },
  { id: "overtime", label: "초과 근무", color: "purple-600", border: "border-purple-600" }
] as const;

const EMPTY_STATES = {
  pending: { Icon: Check, text: "처리할 결재 문서가 없습니다." },
  history: { Icon: History, text: "처리된 결재 내역이 없습니다." },
  my_requests: { Icon: Send, text: "내가 기안한 문서가 없습니다." }
};

const STATUS_UI: Record<string, { Icon: any; text: string; color: string }> = {
  approved: { Icon: CheckCircle2, text: "승인됨", color: "text-blue-600" },
  rejected: { Icon: XCircle, text: "반려됨", color: "text-red-500" },
  pending: { Icon: Clock, text: "진행중", color: "text-gray-500" },
};

export default function ApprovalModal({ isOpen, onClose }: ApprovalModalProps) {
  const [viewMode, setViewMode] = useState<"pending" | "history" | "my_requests">("pending");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  const calcDays = (start: string, end: string, type: string) => {
    if (type.includes('반차')) return 0.5;
    if (type.includes('반반')) return 0.25;
    return Math.ceil(Math.abs(new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1; 
  };

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let leaves: any[] = [], overtimes: any[] = [], lines: any[] = [];
      const isMyReq = viewMode === "my_requests";
      const isPending = viewMode === "pending";

      if (isMyReq) {
        const [leaveRes, overRes] = await Promise.all([
          supabase.from("leave_requests").select("*").eq("user_id", user.id),
          supabase.from("overtime_requests").select("*").eq("user_id", user.id)
        ]);
        leaves = leaveRes.data || []; overtimes = overRes.data || [];
        
        const [lLines, oLines] = await Promise.all([
          leaves.length ? supabase.from("approval_lines").select("*").in("leave_request_id", leaves.map(l => l.id)) : { data: [] },
          overtimes.length ? supabase.from("approval_lines").select("*").in("overtime_request_id", overtimes.map(o => o.id)) : { data: [] }
        ]);
        lines = [...(lLines.data || []), ...(oLines.data || [])];
      } else {
        let query = supabase.from("approval_lines").select("*").eq("approver_id", user.id)
          .order(isPending ? "created_at" : "updated_at", { ascending: false, nullsFirst: false });
        
        query = isPending ? query.eq("status", "pending") : query.in("status", ["approved", "rejected"]);
        const { data: myLines } = await query;

        if (!myLines?.length) { setRequests([]); return; }

        let validLines = myLines;
        if (isPending) {
          const lIds = myLines.map(l => l.leave_request_id).filter(Boolean);
          const oIds = myLines.map(l => l.overtime_request_id).filter(Boolean);
          const [allLLines, allOLines] = await Promise.all([
            lIds.length ? supabase.from("approval_lines").select("*").in("leave_request_id", lIds) : { data: [] },
            oIds.length ? supabase.from("approval_lines").select("*").in("overtime_request_id", oIds) : { data: [] }
          ]);
          const allLines = [...(allLLines.data || []), ...(allOLines.data || [])];

          validLines = myLines.filter(mLine => {
            const reqId = mLine.leave_request_id || mLine.overtime_request_id;
            const targetLine = allLines.filter(l => l.leave_request_id === reqId || l.overtime_request_id === reqId)
                                       .sort((a, b) => a.step_order - b.step_order)
                                       .find(l => l.status === "pending");
            return targetLine?.approver_id === user.id;
          });
        }

        if (!validLines.length) { setRequests([]); return; }
        lines = validLines;

        const lIds = lines.map(l => l.leave_request_id).filter(Boolean);
        const oIds = lines.map(l => l.overtime_request_id).filter(Boolean);
        const [leaveRes, overRes] = await Promise.all([
          lIds.length ? supabase.from("leave_requests").select("*").in("id", lIds) : { data: [] },
          oIds.length ? supabase.from("overtime_requests").select("*").in("id", oIds) : { data: [] }
        ]);
        leaves = leaveRes.data || []; overtimes = overRes.data || [];
      }

      const userIds = [...new Set([...leaves, ...overtimes].map(d => d.user_id))];
      const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, name, position").in("id", userIds) : { data: [] };

      let formatted = lines.map(line => {
        const isLeave = !!line.leave_request_id;
        const details = isLeave ? leaves.find(l => l.id === line.leave_request_id) : overtimes.find(o => o.id === line.overtime_request_id);
        if (!details) return null;

        const profile = profiles?.find(p => p.id === details.user_id);
        const timeStr = isLeave 
          ? (details.start_time ? `${details.start_time.slice(0,5)} ~ ${details.end_time?.slice(0,5)}` : "종일")
          : `${details.start_time?.slice(0,5)} ~ ${details.end_time?.slice(0,5)}`;
        
        let durationStr = isLeave 
          ? `${details.total_leave_days ?? calcDays(details.start_date, details.end_date, details.leave_type)}일`
          : `${details.total_hours || 0}시간${details.recognized_days ? ` (${details.recognized_days}일 보상)` : ""}`;

        return {
          id: line.id, requestId: details.id,
          applicant: profile?.name || "알수없음", role: profile?.position || "직원",
          type: isLeave ? "leave" : "overtime",
          category: isLeave ? details.leave_type : "초과근무",
          date: isLeave ? `${details.start_date} ~ ${details.end_date}` : details.work_date,
          timeRange: timeStr, duration: durationStr,
          hours: isLeave ? undefined : Number(details.total_hours || 0),
          reason: details.reason || "-", handover: details.handover_notes || "-",
          requestDate: new Date(details.created_at).toLocaleDateString(),
          createdAt: details.created_at, status: line.status, rawData: details,
          isHoliday: !!details.is_holiday, requestType: details.request_type || "create",
          processedAt: line.updated_at ? new Date(line.updated_at).toLocaleDateString() : undefined
        };
      }).filter(Boolean) as ApprovalRequest[];

      if (isMyReq) formatted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(formatted);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [supabase, viewMode]);

  useEffect(() => { if (isOpen) fetchApprovals(); }, [isOpen, fetchApprovals]);

  const handleProcess = async (item: ApprovalRequest, status: "approved" | "rejected") => {
    if (!confirm(`정말 ${status === "approved" ? "승인" : "반려"}하시겠습니까?`)) return;
    try {
      const { error } = await supabase.rpc("process_approval_decision", { p_line_id: item.id, p_status: status, p_amount: 0 });
      if (error) throw error;
      alert(`${status === "approved" ? "승인" : "반려"} 처리되었습니다.`);
      fetchApprovals();
      if (selectedRequest?.id === item.id) setSelectedRequest(null);
      router.refresh();
    } catch (e: any) { alert(`오류: ${e.message}`); }
  };

  const Badge = ({ type }: { type: string }) => {
    const config = {
      update: { bg: "bg-orange-50 text-orange-600 border-orange-100", Icon: FilePenLine, txt: "변경" },
      cancel: { bg: "bg-red-50 text-red-600 border-red-100", Icon: FileX2, txt: "취소" },
      create: { bg: "bg-green-50 text-green-600 border-green-100", Icon: FileInput, txt: "신청" }
    }[type] || { bg: "bg-green-50 text-green-600 border-green-100", Icon: FileInput, txt: "신청" };
    return <span className={`px-2 py-0.5 rounded text-xs font-bold border flex items-center gap-1 ${config.bg}`}><config.Icon className="w-3 h-3"/> {config.txt}</span>;
  };

  if (!isOpen) return null;
  const filteredData = requests.filter(item => activeTab === "all" || item.type === activeTab);
  const EmptyIcon = EMPTY_STATES[viewMode].Icon;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          
          {/* 헤더 */}
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-800 text-white">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-yellow-400" /> 결재 문서함</h2>
              <p className="text-xs text-gray-400 mt-1">
                {viewMode === 'pending' ? '승인 대기 중인' : viewMode === 'history' ? '내가 처리한' : '내가 기안한'} 문서가 <span className="text-yellow-400 font-bold">{requests.length}건</span> 있습니다.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
          </div>

          {/* 탭 영역 */}
          <div className="px-6 pt-4 bg-white border-b border-gray-100">
             <div className="flex p-1 bg-gray-100 rounded-lg w-full md:w-fit mb-4">
                {VIEW_MODES.map(tab => (
                  <button key={tab.id} onClick={() => setViewMode(tab.id)} className={`flex-1 md:flex-none px-5 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === tab.id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {tab.label}
                  </button>
                ))}
             </div>
             <div className="flex gap-6">
              {TYPE_TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.id ? `${tab.border} text-${tab.color}` : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 리스트 영역 */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-100/50">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <p className="text-gray-500 text-sm">문서를 불러오는 중...</p>
              </div>
            ) : filteredData.length > 0 ? (
              <div className="space-y-4">
                {filteredData.map(item => {
                  const isPending = viewMode === 'pending';
                  const Status = STATUS_UI[item.status] || STATUS_UI.pending;

                  return (
                    <div key={item.id} onClick={() => setSelectedRequest(item)} className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col md:flex-row gap-5 transition-all cursor-pointer group relative ${isPending ? 'border-gray-200 hover:border-blue-400 hover:shadow-md' : 'border-gray-200 opacity-90 hover:opacity-100'}`}>
                      <div className="absolute top-3 right-3 text-gray-300 group-hover:text-blue-500"><ChevronRight className="w-5 h-5" /></div>

                      <div className="flex items-start gap-3 md:w-[180px] md:border-r md:border-gray-100 md:pr-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPending ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-400'}`}><User className="w-5 h-5" /></div>
                        <div>
                          <div className={`font-bold ${isPending ? 'text-gray-800 group-hover:text-blue-700' : 'text-gray-600'}`}>{item.applicant}</div>
                          <div className="text-xs text-gray-500">{item.role}</div>
                          <div className="text-[10px] text-gray-400 mt-1">{item.requestDate} 신청</div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge type={item.requestType} />
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border shrink-0 ${item.type === 'leave' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>{item.category}</span>
                          {item.isHoliday && <span className="px-2 py-0.5 rounded text-xs font-bold border bg-red-50 text-red-600 border-red-100 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 휴일근무</span>}
                          <span className="text-sm font-bold text-gray-800 flex items-center gap-1 truncate ml-1"><Calendar className="w-3.5 h-3.5 text-gray-400" /> {item.date}</span>
                        </div>
                        <div className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="font-medium text-xs text-gray-500">{item.type === 'leave' ? '기간:' : '시간:'}</span>
                          <span className="font-bold text-gray-700">{item.duration}</span>
                          <span className="text-xs text-gray-400">({item.timeRange})</span>
                        </div>
                        <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded mt-2 truncate"><span className="font-bold text-gray-400 text-xs mr-2">사유</span>{item.reason}</div>
                      </div>

                      <div className="flex md:flex-col gap-2 justify-center md:border-l md:border-gray-100 md:pl-4 min-w-[100px]">
                        {isPending ? (
                          <>
                            <button onClick={e => { e.stopPropagation(); handleProcess(item, "approved"); }} className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-bold shadow-sm"><Check className="w-4 h-4" /> 승인</button>
                            <button onClick={e => { e.stopPropagation(); handleProcess(item, "rejected"); }} className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 py-2 px-3 rounded-lg text-sm font-medium"><XCircle className="w-4 h-4" /> 반려</button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-1 text-center">
                            <div className={`flex flex-col items-center ${Status.color}`}><Status.Icon className="w-6 h-6 mb-1" /><span className="text-xs font-bold">{Status.text}</span></div>
                            {item.processedAt && <div className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-1"><Clock className="w-3 h-3" /> {item.processedAt}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <EmptyIcon className="w-12 h-12 text-gray-300 mb-3" />
                <p>{EMPTY_STATES[viewMode].text}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedRequest?.type === 'leave' && <LeaveApplicationModal isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} initialData={selectedRequest.rawData} />}
      {selectedRequest?.type === 'overtime' && <OvertimeApplicationModal isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} initialData={selectedRequest.rawData} />}
    </>
  );
}
