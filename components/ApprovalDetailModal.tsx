"use client";

import { X, Calendar as CalendarIcon, Clock, Users, FileText, Download, Check, XCircle } from "lucide-react";

interface ApprovalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
}

export default function ApprovalDetailModal({ isOpen, onClose, data }: ApprovalDetailModalProps) {
  if (!isOpen || !data) return null;

  // 데이터가 없을 경우를 대비한 안전 장치 (빈 문자열 처리)
  const safeData = {
    ...data,
    handover: data.handover || "별도의 인수인계 사항 없습니다.",
    subDate1: data.subDate1 || "",
    subTime1: data.subTime1 || "",
    subDate2: data.subDate2 || "",
    subTime2: data.subTime2 || "",
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* 1. 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              휴가 신청서 (결재 대기)
            </h2>
            <p className="text-xs text-gray-500 mt-1">문서번호: 2024-HR-0023 (기안일: {safeData.requestDate})</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 2. 스크롤 가능한 본문 (작성 폼과 동일한 구조) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
          
          {/* 결재선 (현재 단계 강조) */}
          <section>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> 결재선 정보
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {/* 기안자 */}
              <div className="min-w-[100px] p-3 border border-gray-200 bg-gray-50 rounded-lg text-center opacity-70">
                <div className="text-xs text-gray-500 font-bold mb-1">기안</div>
                <div className="text-sm font-bold text-gray-800">{safeData.applicant}</div>
                <div className="text-xs text-gray-500">{safeData.role}</div>
              </div>
              <div className="flex items-center text-gray-300">→</div>
              {/* 결재자 (현재 사용자) - 강조 */}
              <div className="min-w-[100px] p-3 border-2 border-blue-500 bg-blue-50 rounded-lg text-center relative shadow-md">
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">NOW</div>
                <div className="text-xs text-blue-600 font-bold mb-1">결재 (나)</div>
                <div className="text-sm font-bold text-gray-800">관리자</div>
                <div className="text-xs text-gray-500">인사팀장</div>
              </div>
              <div className="flex items-center text-gray-300">→</div>
              {/* 최종 승인자 */}
              <div className="min-w-[100px] p-3 border border-gray-200 rounded-lg text-center relative opacity-50">
                <div className="text-xs text-gray-500 mb-1">승인</div>
                <div className="text-sm font-bold text-gray-400">대표이사</div>
              </div>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* 휴가 상세 내용 (읽기 전용) */}
          <section className="space-y-6">
            
            {/* 휴가 종류 선택 (선택된 것만 강조) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">휴가 종류</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["연차", "오전반차", "오후반차", "대체휴무(종일)", "대체휴무(반일)", "병가", "경조사", "기타"].map((type) => {
                  const isSelected = safeData.category === type;
                  return (
                    <div 
                      key={type} 
                      className={`
                        flex items-center justify-center gap-2 p-3 border rounded-lg transition-all text-sm font-medium
                        ${isSelected 
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-200' 
                          : 'border-gray-100 bg-gray-50 text-gray-400'
                        }
                      `}
                    >
                      {type}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 기간 및 시간 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">휴가 기간</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input 
                      type="text" 
                      readOnly 
                      value={safeData.date} 
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-800 font-bold text-sm focus:outline-none" 
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">사용 시간</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={safeData.timeRange || "-"} 
                    className="flex-1 px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-800 text-sm focus:outline-none text-center" 
                  />
                </div>
              </div>
            </div>

            {/* 사유 및 인수인계 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">휴가 사유</label>
                <textarea 
                  readOnly
                  className="w-full h-24 px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm resize-none text-gray-700 focus:outline-none"
                  value={safeData.reason}
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">업무 인수인계 / 비상연락</label>
                <textarea 
                  readOnly
                  className="w-full h-24 px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm resize-none text-gray-700 focus:outline-none"
                  value={safeData.handover}
                ></textarea>
              </div>
            </div>

            {/* ▼▼▼ 대체휴무 상세 (요청하신 2칸 구조 유지) ▼▼▼ */}
            <div className={`p-5 rounded-lg border space-y-5 transition-colors ${safeData.category.includes('대체') ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
              <h4 className={`text-sm font-bold flex items-center gap-2 ${safeData.category.includes('대체') ? 'text-orange-800' : 'text-gray-500'}`}>
                <Clock className="w-4 h-4" />
                대체휴무 근무 내역
                {!safeData.category.includes('대체') && <span className="text-xs font-normal">(해당 없음)</span>}
              </h4>
              
              {/* 1번 슬롯 */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1 font-bold">대체 근무일 (1)</label>
                  <input type="text" readOnly value={safeData.subDate1} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700" />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs text-gray-500 mb-1 font-bold">근무 시간 (1)</label>
                  <input type="text" readOnly value={safeData.subTime1} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700" />
                </div>
              </div>

              {/* 구분선 */}
              <div className="border-t border-gray-200 border-dashed"></div>

              {/* 2번 슬롯 */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1 font-bold">대체 근무일 (2)</label>
                  <input type="text" readOnly value={safeData.subDate2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700" />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs text-gray-500 mb-1 font-bold">근무 시간 (2)</label>
                  <input type="text" readOnly value={safeData.subTime2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700" />
                </div>
              </div>
            </div>
            {/* ▲▲▲ 대체휴무 상세 끝 ▲▲▲ */}

            {/* 증빙 서류 (다운로드 형태로 변경) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">증빙 서류</label>
              <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white border border-gray-200 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="text-sm text-gray-500">첨부된 파일이 없습니다.</div>
                </div>
                {/* 파일이 있다면 아래 버튼이 활성화됨 */}
                <button disabled className="text-xs font-bold text-gray-400 bg-white px-3 py-1.5 rounded border border-gray-200 cursor-not-allowed">
                  다운로드
                </button>
              </div>
            </div>

          </section>
        </div>

        {/* 3. 푸터 (승인/반려 버튼) */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button 
            onClick={onClose}
            className="flex-1 bg-white border border-red-200 text-red-600 py-3.5 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
          >
            <XCircle className="w-5 h-5" />
            반려
          </button>
          <button 
            onClick={onClose}
            className="flex-[2] bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            최종 승인
          </button>
        </div>

      </div>
    </div>
  );
}
