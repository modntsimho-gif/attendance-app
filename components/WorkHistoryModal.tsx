"use client";

import { useState } from "react";
import { X, Clock, CheckCircle2, AlertCircle, XCircle, Filter, ArrowRight, Calculator } from "lucide-react";

interface WorkHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 데이터에 실제 근무시간(numeric) 추가
const workHistoryData = [
  { id: 1, type: "야간근무", date: "2024-02-14", timeRange: "19:00 ~ 23:00", hours: 4, status: "pending", reason: "긴급 서버 점검" },
  { id: 2, type: "연장근무", date: "2024-02-10", timeRange: "18:00 ~ 21:00", hours: 3, status: "approved", reason: "프로젝트 마감 대응" },
  { id: 3, type: "휴일근무", date: "2024-02-04", timeRange: "13:00 ~ 17:00", hours: 4, status: "rejected", reason: "사전 승인 미비" },
  { id: 4, type: "연장근무", date: "2024-01-25", timeRange: "18:00 ~ 20:00", hours: 2, status: "approved", reason: "고객사 미팅 연장" },
  { id: 5, type: "야간근무", date: "2024-01-10", timeRange: "20:00 ~ 22:00", hours: 2, status: "approved", reason: "정기 배포" },
];

export default function WorkHistoryModal({ isOpen, onClose }: WorkHistoryModalProps) {
  const [activeTab, setActiveTab] = useState("all");

  if (!isOpen) return null;

  const filteredData = workHistoryData.filter(item => {
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
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              초과근무 신청 및 보상 내역
            </h2>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Calculator className="w-3 h-3" />
              보상 기준: 근무시간 × 1.5배 적립 (1일 = 8시간 기준)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 탭 메뉴 */}
        <div className="px-6 pt-4 pb-0 border-b border-gray-200">
          <div className="flex gap-6">
            <button 
              onClick={() => setActiveTab("all")}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'all' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'approved' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              승인 완료
            </button>
          </div>
        </div>

        {/* 리스트 (테이블) */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 font-semibold">근무일 / 유형</th>
                  <th className="px-4 py-3 font-semibold">근무 시간</th>
                  {/* ▼▼▼ 새로 추가된 컬럼 ▼▼▼ */}
                  <th className="px-4 py-3 font-semibold bg-purple-50/50 text-purple-900 border-x border-purple-100">
                    보상 휴가 (1.5배)
                  </th>
                  {/* ▲▲▲ */}
                  <th className="px-4 py-3 font-semibold">업무 내용</th>
                  <th className="px-4 py-3 font-semibold text-center">상태</th>
                  <th className="px-4 py-3 font-semibold text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length > 0 ? (
                  filteredData.map((item) => {
                    // 계산 로직
                    const rewardHours = item.hours * 1.5;
                    const rewardDays = rewardHours / 8; // 8시간 기준

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-800 text-sm">{item.type}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{item.date}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="font-medium">{item.timeRange}</div>
                          <div className="text-xs text-gray-400 mt-0.5">총 {item.hours}시간 근무</div>
                        </td>
                        
                        {/* ▼▼▼ 계산 결과 표시 영역 ▼▼▼ */}
                        <td className="px-4 py-3 bg-purple-50/30 border-x border-purple-50">
                          <div className="flex flex-col gap-1">
                            {/* 계산식 */}
                            <div className="flex items-center gap-1 text-[11px] text-gray-400">
                              <span>{item.hours}h</span>
                              <span>×</span>
                              <span>1.5</span>
                              <span>=</span>
                              <span className="font-medium text-gray-600">{rewardHours}h</span>
                            </div>
                            {/* 최종 발생 일수 */}
                            <div className="flex items-center gap-2">
                              <ArrowRight className="w-3 h-3 text-purple-400" />
                              <span className="text-sm font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                                +{Number.isInteger(rewardDays) ? rewardDays : rewardDays.toFixed(2)}일
                              </span>
                            </div>
                          </div>
                        </td>
                        {/* ▲▲▲ */}

                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate">
                          {item.reason}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {renderStatusBadge(item.status)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.status === 'pending' && (
                            <button className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2 font-medium">
                              취소
                            </button>
                          )}
                          {item.status !== 'pending' && (
                            <span className="text-xs text-gray-300">-</span>
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
