"use client";

import { useState } from "react";
import { X, Calendar, CheckCircle2, AlertCircle, XCircle, Filter } from "lucide-react";

interface LeaveHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 가짜 데이터 (내역)
const historyData = [
  { id: 1, type: "연차", date: "2024-02-15", days: 1, period: "2024-02-15 ~ 2024-02-15", status: "pending", reason: "개인 사정" },
  { id: 2, type: "오전반차", date: "2024-01-20", days: 0.5, period: "2024-01-20 (09:00~13:00)", status: "approved", reason: "병원 진료" },
  { id: 3, type: "연차", date: "2023-12-24", days: 1, period: "2023-12-24 ~ 2023-12-24", status: "rejected", reason: "팀 일정 중복" },
  { id: 4, type: "여름휴가", date: "2023-08-01", days: 3, period: "2023-08-01 ~ 2023-08-03", status: "approved", reason: "리프레시" },
  { id: 5, type: "오후반차", date: "2023-05-10", days: 0.5, period: "2023-05-10 (14:00~18:00)", status: "approved", reason: "은행 업무" },
];

export default function LeaveHistoryModal({ isOpen, onClose }: LeaveHistoryModalProps) {
  const [activeTab, setActiveTab] = useState("all"); // all, pending, approved

  if (!isOpen) return null;

  // 탭에 따라 데이터 필터링
  const filteredData = historyData.filter(item => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return item.status === "pending";
    if (activeTab === "approved") return item.status === "approved";
    return true;
  });

  // 상태 뱃지 렌더링 함수
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><CheckCircle2 className="w-3 h-3"/> 승인완료</span>;
      case "pending":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><AlertCircle className="w-3 h-3"/> 결재대기</span>;
      case "rejected":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3"/> 반려됨</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            연차 사용 및 결재 내역
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 탭 메뉴 */}
        <div className="px-6 pt-4 pb-0 border-b border-gray-200">
          <div className="flex gap-6">
            <button 
              onClick={() => setActiveTab("all")}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              전체 내역
            </button>
            <button 
              onClick={() => setActiveTab("pending")}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'pending' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              결재 진행중
            </button>
            <button 
              onClick={() => setActiveTab("approved")}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'approved' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              사용 완료 (승인)
            </button>
          </div>
        </div>

        {/* 리스트 (테이블) */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 font-semibold">신청일 / 종류</th>
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
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-800 text-sm">{item.type}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{item.date} 신청</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.period}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded">
                          {item.days}일
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate">
                        {item.reason}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderStatusBadge(item.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status === 'pending' && (
                          <button className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2 font-medium">
                            취소요청
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
          </div>
        </div>

        {/* 푸터 */}
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
  );
}
