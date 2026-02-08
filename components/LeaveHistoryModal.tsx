"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, Calendar, CheckCircle2, AlertCircle, XCircle, Filter, Loader2, Trash2, FileText, FilePenLine, FileX2 } from "lucide-react";
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
  request_type?: string; // ⭐️ [NEW] 신청 유형 필드 추가
}

export default function LeaveHistoryModal({ isOpen, onClose, onDelete }: LeaveHistoryModalProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
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
        setLeaves(data);
      }
    }
    setIsLoading(false);
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

    const { data: checkData } = await supabase
      .from("leave_requests")
      .select("id")
      .eq("id", id);

    if (checkData && checkData.length > 0) {
      alert("⚠️ 삭제 실패! Supabase RLS 정책을 확인해주세요.");
      return;
    }

    setLeaves((prev) => prev.filter((item) => item.id !== id));
    alert("신청 내역이 삭제되었습니다.");
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

  const filteredData = leaves.filter(item => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return item.status === "pending";
    if (activeTab === "approved") return item.status === "approved";
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
      default:
        return <span className="text-xs text-gray-500">{status}</span>;
    }
  };

  // ⭐️ [NEW] 신청 유형 뱃지 렌더링 함수
  const renderRequestTypeBadge = (type?: string) => {
    const safeType = type || 'create'; // 기본값: 신청
    switch (safeType) {
      case 'create':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <FileText className="w-3 h-3" /> 신청
          </span>
        );
      case 'update':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
            <FilePenLine className="w-3 h-3" /> 변경
          </span>
        );
      case 'cancel':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-700 border border-pink-200">
            <FileX2 className="w-3 h-3" /> 취소
          </span>
        );
      default:
        return null;
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
                      <th className="px-4 py-3 font-semibold">유형 / 종류 / 신청일</th>
                      <th className="px-4 py-3 font-semibold">기간</th>
                      <th className="px-4 py-3 font-semibold text-center">사용일수</th>
                      <th className="px-4 py-3 font-semibold">사유</th>
                      <th className="px-4 py-3 font-semibold text-center">상태</th>
                      <th className="px-4 py-3 font-semibold text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredData.length > 0 ? (
                      filteredData.map((item) => (
                        <tr 
                          key={item.id} 
                          onClick={() => handleRowClick(item)} 
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-3">
                            {/* ⭐️ [NEW] 유형 뱃지와 휴가 종류 표시 */}
                            <div className="flex items-center gap-2 mb-1">
                                {renderRequestTypeBadge(item.request_type)}
                                <span className="font-bold text-gray-800 text-sm">{item.leave_type}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {new Date(item.created_at).toLocaleDateString()} 신청
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.start_date} ~ {item.end_date}
                          </td>
                          
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                item.request_type === 'cancel' 
                                ? 'bg-red-50 text-red-600 line-through decoration-red-400' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {item.total_leave_days ?? calculateDaysFallback(item.start_date, item.end_date, item.leave_type)}일
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate" title={item.reason}>
                            {item.reason}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {renderStatusBadge(item.status)}
                          </td>
                          
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {item.status === 'pending' && (
                              <button 
                                onClick={() => handleCancel(item.id)}
                                className="text-xs text-red-500 hover:text-red-700 flex items-center justify-center gap-1 mx-auto font-medium transition-colors p-2 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3 h-3" /> 삭제
                              </button>
                            )}
                            {item.status !== 'pending' && (
                              <span className="text-xs text-gray-300">-</span>
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
