"use client";

import { X, Calendar as CalendarIcon, Clock, Users, FileText, Check, XCircle } from "lucide-react";

interface ApprovalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
}

// 휴가 종류 상수 분리
const LEAVE_TYPES = ["연차", "오전반차", "오후반차", "대체휴무(종일)", "대체휴무(반일)", "병가", "경조사", "기타"];

export default function ApprovalDetailModal({ isOpen, onClose, data }: ApprovalDetailModalProps) {
  if (!isOpen || !data) return null;

  // 1. 객체 구조 분해 할당과 동시에 기본값(Default Value) 세팅
  const {
    requestDate, applicant, role, category, date, timeRange, reason,
    handover = "별도의 인수인계 사항 없습니다.",
    subDate1 = "", subTime1 = "", subDate2 = "", subTime2 = ""
  } = data;

  const isSub = category?.includes('대체');
  
  // 2. 반복되는 공통 Tailwind 클래스 추출
  const labelBase = "block text-sm font-bold text-gray-700 mb-2";
  const inputBase = "px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none";
  const readOnlyInput = `w-full bg-gray-50 font-bold ${inputBase}`;
  const textAreaBase = `w-full h-24 bg-gray-50 resize-none ${inputBase}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> 휴가 신청서 (결재 대기)
            </h2>
            <p className="text-xs text-gray-500 mt-1">문서번호: 2024-HR-0023 (기안일: {requestDate})</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 스크롤 가능한 본문 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
          
          {/* 결재선 */}
          <section>
            <h3 className={`${labelBase} flex items-center gap-2 mb-3`}><Users className="w-4 h-4" /> 결재선 정보</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              <div className="min-w-[100px] p-3 border border-gray-200 bg-gray-50 rounded-lg text-center opacity-70">
                <div className="text-xs text-gray-500 font-bold mb-1">기안</div>
                <div className="text-sm font-bold text-gray-800">{applicant}</div>
                <div className="text-xs text-gray-500">{role}</div>
              </div>
              <div className="flex items-center text-gray-300">→</div>
              <div className="min-w-[100px] p-3 border-2 border-blue-500 bg-blue-50 rounded-lg text-center relative shadow-md">
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">NOW</div>
                <div className="text-xs text-blue-600 font-bold mb-1">결재 (나)</div>
                <div className="text-sm font-bold text-gray-800">관리자</div>
                <div className="text-xs text-gray-500">인사팀장</div>
              </div>
              <div className="flex items-center text-gray-300">→</div>
              <div className="min-w-[100px] p-3 border border-gray-200 rounded-lg text-center opacity-50">
                <div className="text-xs text-gray-500 mb-1">승인</div>
                <div className="text-sm font-bold text-gray-400">대표이사</div>
              </div>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* 휴가 상세 내용 */}
          <section className="space-y-6">
            
            {/* 휴가 종류 */}
            <div>
              <label className={labelBase}>휴가 종류</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {LEAVE_TYPES.map((type) => (
                  <div key={type} className={`flex items-center justify-center gap-2 p-3 border rounded-lg transition-all text-sm font-medium ${
                    category === type ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-200' : 'border-gray-100 bg-gray-50 text-gray-400'
                  }`}>
                    {type}
                  </div>
                ))}
              </div>
            </div>

            {/* 기간 및 시간 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelBase}>휴가 기간</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input type="text" readOnly value={date} className={`pl-9 ${readOnlyInput}`} />
                </div>
              </div>
              <div>
                <label className={labelBase}>사용 시간</label>
                <input type="text" readOnly value={timeRange || "-"} className={`text-center ${readOnlyInput}`} />
              </div>
            </div>

            {/* 사유 및 인수인계 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelBase}>휴가 사유</label>
                <textarea readOnly value={reason} className={textAreaBase} />
              </div>
              <div>
                <label className={labelBase}>업무 인수인계 / 비상연락</label>
                <textarea readOnly value={handover} className={textAreaBase} />
              </div>
            </div>

            {/* 대체휴무 상세 (배열 매핑으로 중복 제거) */}
            <div className={`p-5 rounded-lg border space-y-5 transition-colors ${isSub ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
              <h4 className={`text-sm font-bold flex items-center gap-2 ${isSub ? 'text-orange-800' : 'text-gray-500'}`}>
                <Clock className="w-4 h-4" /> 대체휴무 근무 내역 {!isSub && <span className="text-xs font-normal">(해당 없음)</span>}
              </h4>
              
              {[ { d: subDate1, t: subTime1 }, { d: subDate2, t: subTime2 } ].map((item, idx) => (
                <div key={idx} className="space-y-5">
                  {idx > 0 && <div className="border-t border-gray-200 border-dashed" />}
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                    <div className="md:col-span-3">
                      <label className="block text-xs text-gray-500 mb-1 font-bold">대체 근무일 ({idx + 1})</label>
                      <input type="text" readOnly value={item.d} className={`w-full bg-white ${inputBase}`} />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs text-gray-500 mb-1 font-bold">근무 시간 ({idx + 1})</label>
                      <input type="text" readOnly value={item.t} className={`w-full bg-white ${inputBase}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 증빙 서류 */}
            <div>
              <label className={labelBase}>증빙 서류</label>
              <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white border border-gray-200 rounded-lg"><FileText className="w-5 h-5 text-gray-400" /></div>
                  <div className="text-sm text-gray-500">첨부된 파일이 없습니다.</div>
                </div>
                <button disabled className="text-xs font-bold text-gray-400 bg-white px-3 py-1.5 rounded border border-gray-200 cursor-not-allowed">
                  다운로드
                </button>
              </div>
            </div>

          </section>
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={onClose} className="flex-1 bg-white border border-red-200 text-red-600 py-3.5 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2">
            <XCircle className="w-5 h-5" /> 반려
          </button>
          <button onClick={onClose} className="flex-[2] bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2">
            <Check className="w-5 h-5" /> 최종 승인
          </button>
        </div>

      </div>
    </div>
  );
}
