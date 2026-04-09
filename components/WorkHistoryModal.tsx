"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client"; 
import { useRouter } from "next/navigation";
import { X, Clock, CheckCircle2, AlertCircle, XCircle, Filter, ArrowRight, Calculator, Loader2, Trash2, FileText, FilePenLine, FileX2, History, ChevronRight, Calendar } from "lucide-react";
import OvertimeApplicationModal from "./OvertimeApplicationModal";
import { deleteOvertimeRequest } from "@/app/actions/overtime"; 

// --- UI 상수 정의 ---
const STATUS_UI: Record<string, { Icon: any, text: string, bg: string }> = {
  approved: { Icon: CheckCircle2, text: "승인완료", bg: "bg-blue-100 text-blue-800" },
  pending: { Icon: AlertCircle, text: "결재대기", bg: "bg-orange-100 text-orange-800" },
  rejected: { Icon: XCircle, text: "반려됨", bg: "bg-red-100 text-red-800" },
  cancelled: { Icon: XCircle, text: "취소됨", bg: "bg-gray-100 text-gray-600" },
};

const TYPE_UI: Record<string, { Icon: any, text: string, bg: string }> = {
  create: { Icon: FileText, text: "신청", bg: "bg-slate-100 text-slate-600 border-slate-200" },
  update: { Icon: FilePenLine, text: "변경", bg: "bg-purple-100 text-purple-700 border-purple-200" },
  cancel: { Icon: FileX2, text: "취소", bg: "bg-pink-100 text-pink-700 border-pink-200" },
};

const TABS = [
  { id: "all", label: "전체 내역", color: "border-purple-600 text-purple-600" },
  { id: "pending", label: "결재 진행중", color: "border-orange-500 text-orange-600" },
  { id: "approved", label: "승인 완료", color: "border-blue-600 text-blue-600" }
];

// --- 타입 정의 ---
interface WorkHistoryModalProps { isOpen: boolean; onClose: () => void; }
interface OvertimeRequest { id: string; title: string; work_date: string; start_time: string; end_time: string; total_hours: number; recognized_hours: number; recognized_days: number; is_holiday: boolean; reason: string; status: string; created_at: string; request_type?: string; original_overtime_request_id?: string; }
interface WorkGroup { latest: OvertimeRequest; count: number; }

export default function WorkHistoryModal({ isOpen, onClose }: WorkHistoryModalProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [workGroups, setWorkGroups] = useState<WorkGroup[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWork, setSelectedWork] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => { if (isOpen) fetchOvertimeHistory(); }, [isOpen]);

  const fetchOvertimeHistory = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("overtime_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) processData(data);
    }
    setIsLoading(false);
  };

  // ⭐️ [최적화] 재귀와 reduce를 활용한 데이터 그룹핑
  const processData = (data: OvertimeRequest[]) => {
    const itemMap = new Map(data.map(item => [item.id, item]));
    const getRoot = (id: string): string => itemMap.get(id)?.original_overtime_request_id ? getRoot(itemMap.get(id)!.original_overtime_request_id!) : id;
    
    const groups = data.reduce((acc: Record<string, OvertimeRequest[]>, item) => {
      const root = getRoot(item.id);
      (acc[root] = acc[root] || []).push(item);
      return acc;
    }, {});

    const processed = Object.values(groups).map(group => {
      group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { latest: group[0], count: group.length };
    }).sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());

    setWorkGroups(processed);
  };

  const handleCancel = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("정말 이 신청을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.")) return;
    
    const result = await deleteOvertimeRequest(id);
    if (result.error) return alert("삭제 실패: " + result.error);

    alert("삭제되었습니다.");
    fetchOvertimeHistory();
    router.refresh(); 
  };

  const filteredGroups = workGroups.filter(({ latest }) => activeTab === "all" || latest.status === activeTab);

  // ⭐️ [최적화] 뱃지 컴포넌트 분리
  const StatusBadge = ({ status }: { status: string }) => {
    const conf = STATUS_UI[status];
    if (!conf) return null;
    return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${conf.bg}`}><conf.Icon className="w-3 h-3"/> {conf.text}</span>;
  };

  const TypeBadge = ({ type = 'create' }: { type?: string }) => {
    const conf = TYPE_UI[type] || TYPE_UI.create;
    return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${conf.bg}`}><conf.Icon className="w-3 h-3" /> {conf.text}</span>;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
          
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Clock className="w-5 h-5 text-purple-600" /> 초과근무 신청 및 보상 내역</h2>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Calculator className="w-3 h-3" /> 보상 기준: 평일/토 1.5배, 일/공휴일 2.0배</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
          </div>

          <div className="px-6 pt-4 pb-0 border-b border-gray-200 bg-white">
            <div className="flex gap-6 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? tab.color : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/30">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400"><Loader2 className="w-8 h-8 animate-spin mb-2 text-purple-500" /><p>데이터를 불러오는 중...</p></div>
            ) : filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 gap-2"><Filter className="w-8 h-8 opacity-20" /><span>해당하는 내역이 없습니다.</span></div>
            ) : (
                <>
                {/* ⭐️ [Mobile] 카드 리스트 뷰 */}
                <div className="md:hidden space-y-3">
                  {filteredGroups.map(({ latest, count }) => {
                    const { total_hours: hours = 0, recognized_hours: rewardHours = 0, recognized_days: rewardDays = 0, is_holiday: isHoliday } = latest;
                    return (
                      <div key={latest.id} onClick={() => { setSelectedWork(latest); setIsDetailOpen(true); }} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm active:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                             <TypeBadge type={latest.request_type} />
                             {count > 1 && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-gray-200 font-medium"><History className="w-3 h-3" /> +{count - 1}</span>}
                          </div>
                          <StatusBadge status={latest.status} />
                        </div>

                        <div className="mb-3">
                          <div className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                            {latest.work_date} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{hours}h 근무</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium mb-2"><Clock className="w-4 h-4 text-gray-400" /> {latest.start_time} ~ {latest.end_time}</div>
                          
                          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 flex items-center justify-between">
                             <div className="flex items-center gap-1.5">
                                <Calculator className="w-4 h-4 text-purple-500" /><span className="text-xs font-bold text-purple-700">보상 휴가</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isHoliday ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{isHoliday ? '2.0배' : '1.5배'}</span>
                             </div>
                             <div className={`text-sm font-bold ${latest.request_type === 'cancel' ? 'text-red-500 line-through decoration-red-400' : 'text-purple-700'}`}>
                                {rewardHours}h ({Number(rewardDays).toFixed(2)}일)
                             </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-end border-t border-gray-100 pt-3">
                          <div className="flex flex-col gap-1">
                              <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(latest.created_at).toLocaleDateString()} 신청</span>
                              {latest.reason && <p className="text-xs text-gray-500 truncate max-w-[200px]">{latest.reason}</p>}
                          </div>
                          {latest.status === 'pending' ? (
                             <button onClick={(e) => handleCancel(latest.id, e)} className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-50 flex items-center gap-1 shadow-sm"><Trash2 className="w-3 h-3" /> 삭제</button>
                          ) : <ChevronRight className="w-5 h-5 text-gray-300" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ⭐️ [Desktop] 테이블 뷰 */}
                <div className="hidden md:block bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden min-h-[300px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                        <th className="px-4 py-3 font-semibold">유형 / 근무일</th>
                        <th className="px-4 py-3 font-semibold">근무 시간</th>
                        <th className="px-4 py-3 font-semibold bg-purple-50/50 text-purple-900 border-x border-purple-100">보상 휴가</th>
                        <th className="px-4 py-3 font-semibold">업무 내용</th>
                        <th className="px-4 py-3 font-semibold text-center">상태</th>
                        <th className="px-4 py-3 font-semibold text-center">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredGroups.map(({ latest, count }) => {
                          const { total_hours: hours = 0, recognized_hours: rewardHours = 0, recognized_days: rewardDays = 0, is_holiday: isHoliday } = latest;
                          return (
                            <tr key={latest.id} onClick={() => { setSelectedWork(latest); setIsDetailOpen(true); }} className="hover:bg-purple-50/50 transition-colors cursor-pointer group">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <TypeBadge type={latest.request_type} />
                                  <span className="font-bold text-gray-800 text-sm">{latest.work_date}</span>
                                  {count > 1 && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-gray-200" title="변경/취소 이력이 포함된 건입니다"><History className="w-3 h-3" /> +{count - 1}</span>}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">{latest.title}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                <div className="font-medium">{latest.start_time} ~ {latest.end_time}</div>
                                <div className="text-xs text-gray-400 mt-0.5">총 {hours}시간 근무</div>
                              </td>
                              <td className="px-4 py-3 bg-purple-50/30 border-x border-purple-50">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                                    <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${isHoliday ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{isHoliday ? '공휴일 2.0배' : '1.5배'}</span>
                                    <span>적용</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ArrowRight className="w-3 h-3 text-purple-400" />
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded border ${latest.request_type === 'cancel' ? 'bg-red-50 text-red-600 border-red-200 line-through decoration-red-400' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                                      {rewardHours}h ({Number(rewardDays).toFixed(2)}일)
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate" title={latest.reason}>{latest.reason}</td>
                              <td className="px-4 py-3 text-center"><StatusBadge status={latest.status} /></td>
                              <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                {latest.status === 'pending' ? (
                                  <button onClick={(e) => { e.stopPropagation(); handleCancel(latest.id); }} className="text-xs text-red-500 hover:text-red-700 flex items-center justify-center gap-1 mx-auto font-medium transition-colors p-2 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /> 삭제</button>
                                ) : <div className="text-gray-300 flex justify-center"><ChevronRight className="w-4 h-4" /></div>}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                </>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-900 transition-colors text-sm">닫기</button>
          </div>
        </div>
      </div>

      <OvertimeApplicationModal isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); fetchOvertimeHistory(); }} initialData={selectedWork} />
    </>
  );
}
