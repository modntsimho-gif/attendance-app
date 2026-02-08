"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, Calendar, CheckCircle2, AlertCircle, XCircle, Filter, Loader2, Trash2, FileText, FilePenLine, FileX2, History, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import LeaveApplicationModal from "./LeaveApplicationModal"; 

interface LeaveHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
  total_leave_days?: number;
  request_type?: string;
  original_leave_request_id?: string;
}

interface LeaveGroup {
  latest: LeaveRequest;
  count: number;
}

export default function LeaveHistoryModal({ isOpen, onClose, onDelete }: LeaveHistoryModalProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [leaveGroups, setLeaveGroups] = useState<LeaveGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      fetchLeaveHistory();
    }
  }, [isOpen]);

  const fetchLeaveHistory = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        processData(data);
      }
    }
    setIsLoading(false);
  };

  // ⭐️ [수정됨] 연결된 모든 이력을 추적하여 하나의 그룹으로 묶는 로직
  const processData = (data: LeaveRequest[]) => {
    // 1. 빠른 조회를 위한 ID -> Item 맵 생성
    const itemMap = new Map<string, LeaveRequest>();
    // 2. 부모 관계 추적을 위한 맵 (Child ID -> Parent ID)
    const parentMap = new Map<string, string>();

    data.forEach(item => {
      itemMap.set(item.id, item);
      if (item.original_leave_request_id) {
        parentMap.set(item.id, item.original_leave_request_id);
      }
    });

    // 3. 최상위 루트 ID를 찾는 재귀(반복문) 함수
    const findRootId = (currentId: string): string => {
      let pointer = currentId;
      // 부모가 있는 동안 계속 거슬러 올라감
      while (parentMap.has(pointer)) {
        pointer = parentMap.get(pointer)!;
        // 만약 데이터 무결성 문제로 부모 ID가 현재 리스트에 없다면 루프 종료
        if (!itemMap.has(pointer)) break; 
      }
      return pointer;
    };

    // 4. 그룹화 진행
    const groups: Record<string, LeaveRequest[]> = {};

    data.forEach((item) => {
      const rootId = findRootId(item.id);
      
      if (!groups[rootId]) {
        groups[rootId] = [];
      }
      groups[rootId].push(item);
    });

    // 5. 그룹별 정렬 및 포맷팅
    const processed = Object.values(groups).map((groupList) => {
      // 그룹 내 시간순 정렬 (내림차순: 최신이 [0])
      groupList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return {
        latest: groupList[0], // 가장 최신 상태 (예: 취소)
        count: groupList.length // 전체 이력 수 (예: 신청+변경+취소 = 3)
      };
    });

    // 6. 최종 목록 정렬 (최신 업데이트 순)
    processed.sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());

    setLeaveGroups(processed);
  };

  const handleCancel = async (id: string) => {
    if (!confirm("정말 이 신청을 삭제하시겠습니까? 복구할 수 없습니다.")) return;

    const { error } = await supabase
      .from("leave_requests")
      .delete()
      .eq("id", id);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    
    alert("신청 내역이 삭제되었습니다.");
    fetchLeaveHistory();
    if (onDelete) onDelete();
    router.refresh();
  };

  const handleRowClick = (item: LeaveRequest) => {
    setSelectedLeave(item);
    setIsDetailOpen(true);
  };

  const calculateDaysFallback = (start: string, end: string, type: string) => {
    if (type.includes("반차")) return 0.5;
    if (type.includes("반반")) return 0.25;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  };

  const filteredGroups = leaveGroups.filter(({ latest }) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return latest.status === "pending";
    if (activeTab === "approved") return latest.status === "approved";
    return true;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><CheckCircle2 className="w-3 h-3"/> 승인완료</span>;
      case "pending":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><AlertCircle className="w-3 h-3"/> 결재대기</span>;
      case "rejected":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3"/> 반려됨</span>;
      case "cancelled":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><XCircle className="w-3 h-3"/> 취소됨</span>;
      default:
        return <span className="text-xs text-gray-500">{status}</span>;
    }
  };

  const renderRequestTypeBadge = (type?: string) => {
    const safeType = type || 'create';
    switch (safeType) {
      case 'create':
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"><FileText className="w-3 h-3" /> 신청</span>;
      case 'update':
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200"><FilePenLine className="w-3 h-3" /> 변경</span>;
      case 'cancel':
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-700 border border-pink-200"><FileX2 className="w-3 h-3" /> 취소</span>;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              연차 사용 및 결재 내역
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 pt-4 pb-0 border-b border-gray-200">
            <div className="flex gap-6">
              <button onClick={() => setActiveTab("all")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>전체 내역</button>
              <button onClick={() => setActiveTab("pending")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'pending' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>결재 진행중</button>
              <button onClick={() => setActiveTab("approved")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'approved' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>사용 완료 (승인)</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden min-h-[300px]">
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
                  <p>데이터를 불러오는 중...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                      <th className="px-4 py-3 font-semibold">최종 상태 / 종류 / 신청일</th>
                      <th className="px-4 py-3 font-semibold">기간</th>
                      <th className="px-4 py-3 font-semibold text-center">사용일수</th>
                      <th className="px-4 py-3 font-semibold">사유</th>
                      <th className="px-4 py-3 font-semibold text-center">결재 상태</th>
                      <th className="px-4 py-3 font-semibold text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map(({ latest, count }) => (
                        <tr 
                          key={latest.id} 
                          onClick={() => handleRowClick(latest)} 
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                                {renderRequestTypeBadge(latest.request_type)}
                                <span className="font-bold text-gray-800 text-sm">{latest.leave_type}</span>
                                
                                {/* ⭐️ 이력이 2건 이상일 때만 뱃지 표시 (신청+변경+취소 = 3건 -> +2) */}
                                {count > 1 && (
                                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-gray-200" title="변경/취소 이력이 포함된 건입니다">
                                    <History className="w-3 h-3" />
                                    +{count - 1}
                                  </span>
                                )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {new Date(latest.created_at).toLocaleDateString()} 
                              {latest.request_type !== 'create' ? ' 업데이트' : ' 신청'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {latest.start_date} ~ {latest.end_date}
                          </td>
                          
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                latest.request_type === 'cancel' 
                                ? 'bg-red-50 text-red-600 line-through decoration-red-400' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {latest.total_leave_days ?? calculateDaysFallback(latest.start_date, latest.end_date, latest.leave_type)}일
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate" title={latest.reason}>
                            {latest.reason}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {renderStatusBadge(latest.status)}
                          </td>
                          
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {latest.status === 'pending' && (
                              <button 
                                onClick={() => handleCancel(latest.id)}
                                className="text-xs text-red-500 hover:text-red-700 flex items-center justify-center gap-1 mx-auto font-medium transition-colors p-2 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3 h-3" /> 삭제
                              </button>
                            )}
                            {latest.status !== 'pending' && (
                              <div className="text-gray-300 flex justify-center">
                                  <ChevronRight className="w-4 h-4" />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          <div className="flex flex-col items-center gap-2">
                            <Filter className="w-8 h-8 opacity-20" />
                            <span>해당하는 내역이 없습니다.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button 
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-900 transition-colors text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      <LeaveApplicationModal 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
        initialData={selectedLeave} 
      />
    </>
  );
}
