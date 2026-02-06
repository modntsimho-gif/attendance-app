"use client";

import { useState } from "react";
import { X, Check, XCircle, FileText, Clock, User, Calendar, ArrowRight, ChevronRight } from "lucide-react";
import ApprovalDetailModal from "./ApprovalDetailModal"; // 1. import 추가

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// components/ApprovalModal.tsx 내부의 데이터 부분

const approvalData = [
    { 
      id: 1, 
      applicant: "김토스", 
      role: "매니저", 
      type: "leave", 
      category: "연차",
      date: "2024-02-20 ~ 2024-02-21", 
      timeRange: "종일",
      duration: "2일",
      reason: "개인 사정으로 인한 연차 사용 (가족 여행)",
      handover: "급한 건은 슬랙으로 연락 부탁드립니다. 프로젝트 A 관련 파일은 공유 드라이브에 업로드 완료했습니다.",
      requestDate: "2024-02-06 10:30",
    },
    { 
      id: 2, 
      applicant: "이디자", 
      role: "디자이너", 
      type: "overtime", 
      category: "대체휴무(종일)", // 대체휴무 예시
      date: "2024-03-05", 
      timeRange: "09:00 ~ 18:00",
      hours: 8,
      reason: "지난 주말 긴급 배포 대응으로 인한 대체 휴무 신청",
      handover: "디자인 시안은 피그마에 최신화 해두었습니다.",
      subDate1: "2024-02-03 (토)",
      subTime1: "13:00 ~ 22:00",
      requestDate: "2024-02-06 09:15",
    },
    { 
      id: 3, 
      applicant: "박개발", 
      role: "엔지니어", 
      type: "leave", 
      category: "오전반차",
      date: "2024-02-12", 
      timeRange: "09:00 ~ 13:00",
      duration: "0.5일",
      reason: "병원 정기 검진",
      handover: "오후 1시부터 정상 근무 가능합니다.",
      requestDate: "2024-02-05 18:20",
    },
  ];

export default function ApprovalModal({ isOpen, onClose }: ApprovalModalProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null); // 2. 선택된 항목 상태

  if (!isOpen) return null;

  const filteredData = approvalData.filter(item => {
    if (activeTab === "all") return true;
    if (activeTab === "leave") return item.type === "leave";
    if (activeTab === "overtime") return item.type === "overtime";
    return true;
  });

  return (
    <>
      {/* 3. 상세 모달 연결 */}
      <ApprovalDetailModal 
        isOpen={!!selectedRequest} 
        onClose={() => setSelectedRequest(null)} 
        data={selectedRequest} 
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          
          {/* 헤더 */}
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-800 text-white">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-yellow-400" />
                결재 대기 문서함
              </h2>
              <p className="text-xs text-gray-400 mt-1">승인 대기 중인 문서가 <span className="text-yellow-400 font-bold">{approvalData.length}건</span> 있습니다.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 탭 메뉴 */}
          <div className="px-6 pt-4 pb-0 border-b border-gray-200 bg-gray-50">
            <div className="flex gap-6">
              <button 
                onClick={() => setActiveTab("all")}
                className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'all' ? 'border-gray-800 text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                전체
              </button>
              <button 
                onClick={() => setActiveTab("leave")}
                className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'leave' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                휴가 신청
              </button>
              <button 
                onClick={() => setActiveTab("overtime")}
                className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overtime' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                초과 근무
              </button>
            </div>
          </div>

          {/* 리스트 영역 */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-100/50">
            <div className="space-y-4">
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <div 
                    key={item.id} 
                    // 4. 클릭 이벤트 추가
                    onClick={() => setSelectedRequest(item)}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col md:flex-row gap-5 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group relative"
                  >
                    
                    {/* 호버 시 '상세보기' 힌트 */}
                    <div className="absolute top-3 right-3 text-gray-300 group-hover:text-blue-500 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>

                    {/* 1. 기안자 정보 */}
                    <div className="flex items-start gap-3 md:w-[180px] md:border-r md:border-gray-100 md:pr-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{item.applicant}</div>
                        <div className="text-xs text-gray-500">{item.role}</div>
                        <div className="text-[10px] text-gray-400 mt-1">{item.requestDate}</div>
                      </div>
                    </div>

                    {/* 2. 상세 내용 */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          item.type === 'leave' 
                            ? 'bg-blue-50 text-blue-600 border-blue-100' 
                            : 'bg-purple-50 text-purple-600 border-purple-100'
                        }`}>
                          {item.category}
                        </span>
                        <span className="text-sm font-bold text-gray-800 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {item.date}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600">
                        {item.type === 'leave' ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">신청 기간:</span>
                            <span>{item.duration}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">근무 시간:</span>
                              <span>{item.timeRange} ({item.hours}h)</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs bg-purple-50 w-fit px-2 py-1 rounded text-purple-700">
                              <span className="font-bold">보상:</span>
                              <span>{item.hours}h × 1.5 = {(item.hours || 0) * 1.5}h</span>
                              <ArrowRight className="w-3 h-3" />
                              <span className="font-bold">+{(item.hours || 0) * 1.5 / 8}일 적립</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded mt-2 truncate">
                        <span className="font-bold text-gray-400 text-xs mr-2">사유</span>
                        {item.reason}
                      </div>
                    </div>

                    {/* 3. 버튼 영역 (리스트에서도 바로 처리 가능하도록 유지하되, 이벤트 전파 막음) */}
                    <div className="flex md:flex-col gap-2 justify-center md:border-l md:border-gray-100 md:pl-4 min-w-[100px]">
                      <button 
                        onClick={(e) => { e.stopPropagation(); /* 승인 로직 */ }}
                        className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-bold transition-colors shadow-sm"
                      >
                        <Check className="w-4 h-4" /> 승인
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); /* 반려 로직 */ }}
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
          </div>

        </div>
      </div>
    </>
  );
}
