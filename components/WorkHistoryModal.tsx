"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client"; 
import { useRouter } from "next/navigation";
import { X, Clock, CheckCircle2, AlertCircle, XCircle, Filter, ArrowRight, Calculator, Loader2, Trash2, FileText, FilePenLine, FileX2, History, ChevronRight } from "lucide-react";
import OvertimeApplicationModal from "./OvertimeApplicationModal";
import { deleteOvertimeRequest } from "@/app/actions/overtime"; 

interface WorkHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// [MODIFIED] DB 컬럼에 맞춰 인터페이스 수정
interface OvertimeRequest {
  id: string;
  title: string;
  work_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  
  recognized_hours: number; 
  recognized_days: number;
  is_holiday: boolean;

  reason: string;
  status: string;
  created_at: string;
  request_type?: string; 
  original_overtime_request_id?: string; // ⭐️ 그룹화를 위한 필드 추가
}

// ⭐️ 그룹화된 데이터 타입 정의
interface WorkGroup {
  latest: OvertimeRequest; // 화면에 보여줄 최종 상태
  count: number;           // 이력 건수
}

export default function WorkHistoryModal({ isOpen, onClose }: WorkHistoryModalProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [workGroups, setWorkGroups] = useState<WorkGroup[]>([]); // ⭐️ 그룹화된 상태 사용
  const [isLoading, setIsLoading] = useState(false);

  // 상세 보기 모달 상태
  const [selectedWork, setSelectedWork] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      fetchOvertimeHistory();
    }
  }, [isOpen]);

  const fetchOvertimeHistory = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data, error } = await supabase
        .from("overtime_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        processData(data); // ⭐️ 데이터 가공 함수 호출
      }
    }
    setIsLoading(false);
  };

  // ⭐️ [핵심] 데이터를 그룹화하여 최종 상태만 남기는 함수
  const processData = (data: OvertimeRequest[]) => {
    // 1. ID 매핑 및 부모 추적 맵 생성
    const itemMap = new Map<string, OvertimeRequest>();
    const parentMap = new Map<string, string>();

    data.forEach(item => {
      itemMap.set(item.id, item);
      if (item.original_overtime_request_id) {
        parentMap.set(item.id, item.original_overtime_request_id);
      }
    });

    // 2. 최상위 루트 ID를 찾는 재귀적 함수
    const findRootId = (currentId: string): string => {
      let pointer = currentId;
      while (parentMap.has(pointer)) {
        pointer = parentMap.get(pointer)!;
        if (!itemMap.has(pointer)) break; // 데이터 무결성 보호
      }
      return pointer;
    };

    // 3. 그룹화 진행
    const groups: Record<string, OvertimeRequest[]> = {};

    data.forEach((item) => {
      const rootId = findRootId(item.id);
      if (!groups[rootId]) groups[rootId] = [];
      groups[rootId].push(item);
    });

    // 4. 그룹별 정렬 (최신순) 및 구조화
    const processed = Object.values(groups).map((groupList) => {
      groupList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return {
        latest: groupList[0], // 가장 최신 상태
        count: groupList.length // 이력 건수
      };
    });

    // 5. 전체 목록 정렬 (최신 업데이트 순)
    processed.sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());

    setWorkGroups(processed);
  };

  const handleCancel = async (id: string) => {
    if (!confirm("정말 이 신청을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.")) return;
    
    const result = await deleteOvertimeRequest(id);

    if (result.error) {
      alert("삭제 실패: " + result.error);
      return;
    }

    alert("삭제되었습니다.");
    fetchOvertimeHistory(); // ⭐️ 삭제 후 목록 재구성 (그룹 재계산 필요)
    router.refresh(); 
  };

  const handleRowClick = (item: OvertimeRequest) => {
    setSelectedWork(item);
    setIsDetailOpen(true);
  };

  // ⭐️ 필터링 로직 수정 (그룹의 최신 상태 기준)
  const filteredGroups = workGroups.filter(({ latest }) => {
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
        return null;
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
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
          
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                초과근무 신청 및 보상 내역
              </h2>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Calculator className="w-3 h-3" />
                보상 기준: 평일/토 1.5배, 일/공휴일 2.0배 (2시간 단위 인정)
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 pt-4 pb-0 border-b border-gray-200">
            <div className="flex gap-6">
              <button onClick={() => setActiveTab("all")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'all' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>전체 내역</button>
              <button onClick={() => setActiveTab("pending")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'pending' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>결재 진행중</button>
              <button onClick={() => setActiveTab("approved")} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'approved' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>승인 완료</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden min-h-[300px]">
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-2 text-purple-500" />
                  <p>데이터를 불러오는 중...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                      <th className="px-4 py-3 font-semibold">유형 / 근무일</th>
                      <th className="px-4 py-3 font-semibold">근무 시간</th>
                      <th className="px-4 py-3 font-semibold bg-purple-50/50 text-purple-900 border-x border-purple-100">
                        보상 휴가
                      </th>
                      <th className="px-4 py-3 font-semibold">업무 내용</th>
                      <th className="px-4 py-3 font-semibold text-center">상태</th>
                      <th className="px-4 py-3 font-semibold text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map(({ latest, count }) => {
                        const hours = latest.total_hours || 0;
                        const rewardHours = latest.recognized_hours || 0;
                        const rewardDays = latest.recognized_days || 0;
                        const isHoliday = latest.is_holiday;

                        return (
                          <tr 
                            key={latest.id} 
                            onClick={() => handleRowClick(latest)} 
                            className="hover:bg-purple-50/50 transition-colors cursor-pointer group"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 mb-1">
                                {renderRequestTypeBadge(latest.request_type)}
                                <span className="font-bold text-gray-800 text-sm">{latest.work_date}</span>
                                
                                {/* ⭐️ 이력이 2건 이상일 때만 뱃지 표시 */}
                                {count > 1 && (
                                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-gray-200" title="변경/취소 이력이 포함된 건입니다">
                                    <History className="w-3 h-3" />
                                    +{count - 1}
                                  </span>
                                )}
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
                                  {isHoliday ? (
                                    <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-bold text-[10px]">공휴일 2.0배</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-bold text-[10px]">1.5배</span>
                                  )}
                                  <span>적용</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="w-3 h-3 text-purple-400" />
                                  <span className={`text-sm font-bold px-2 py-0.5 rounded border ${
                                      latest.request_type === 'cancel' 
                                      ? 'bg-red-50 text-red-600 border-red-200 line-through decoration-red-400' 
                                      : 'bg-purple-100 text-purple-700 border-purple-200'
                                  }`}>
                                    {rewardHours}h ({Number(rewardDays).toFixed(2)}일)
                                  </span>
                                </div>
                              </div>
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancel(latest.id);
                                  }}
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
                        );
                      })
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

      <OvertimeApplicationModal 
        isOpen={isDetailOpen} 
        onClose={() => {
          setIsDetailOpen(false);
          fetchOvertimeHistory(); 
        }} 
        initialData={selectedWork} 
      />
    </>
  );
}
