"use client";

import { X, Upload, Calendar as CalendarIcon, Clock, Users, FileText } from "lucide-react";

interface LeaveApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LeaveApplicationModal({ isOpen, onClose }: LeaveApplicationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* 1. 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              휴가 신청서 작성
            </h2>
            <p className="text-xs text-gray-500 mt-1">문서번호: 자동생성 (임시저장)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 2. 스크롤 가능한 본문 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* 결재선 */}
          <section>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> 결재선 지정
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {/* 기안자 */}
              <div className="min-w-[100px] p-3 border border-blue-200 bg-blue-50 rounded-lg text-center">
                <div className="text-xs text-blue-600 font-bold mb-1">기안</div>
                <div className="text-sm font-bold text-gray-800">김토스</div>
                <div className="text-xs text-gray-500">매니저</div>
              </div>
              <div className="flex items-center text-gray-300">→</div>
              {/* 결재자 1 */}
              <div className="min-w-[100px] p-3 border border-gray-200 rounded-lg text-center relative group cursor-pointer hover:border-blue-300">
                <div className="text-xs text-gray-500 mb-1">결재 (팀장)</div>
                <div className="text-sm font-bold text-gray-400 group-hover:text-blue-600">+ 선택</div>
              </div>
              <div className="flex items-center text-gray-300">→</div>
              {/* 결재자 2 */}
              <div className="min-w-[100px] p-3 border border-gray-200 rounded-lg text-center relative group cursor-pointer hover:border-blue-300">
                <div className="text-xs text-gray-500 mb-1">승인 (대표)</div>
                <div className="text-sm font-bold text-gray-400 group-hover:text-blue-600">+ 선택</div>
              </div>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* 휴가 상세 입력 */}
          <section className="space-y-6">
            
            {/* 휴가 종류 선택 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">휴가 종류 <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["연차", "오전반차", "오후반차", "대체휴무(종일)", "대체휴무(반일)", "병가", "경조사", "기타"].map((type) => (
                  <label key={type} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 transition-all">
                    <input type="radio" name="leaveType" className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 기간 및 시간 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">휴가 기간 <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input type="date" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <span className="text-gray-400">~</span>
                  <div className="relative flex-1">
                    <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input type="date" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">사용 시간 (반차/시간제)</label>
                <div className="flex items-center gap-2">
                  <input type="time" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  <span className="text-gray-400">~</span>
                  <input type="time" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
              </div>
            </div>

            {/* 사유 및 인수인계 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">휴가 사유</label>
                <textarea 
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                  placeholder="예: 개인 사정으로 인한 연차 사용"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">업무 인수인계 / 비상연락</label>
                <textarea 
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                  placeholder="예: 급한 건은 슬랙으로 연락 부탁드립니다."
                ></textarea>
              </div>
            </div>

            {/* ▼▼▼ 대체휴무 상세 (업데이트됨: 2칸으로 확장) ▼▼▼ */}
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 space-y-5">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                대체휴무 근무 내역 (해당 시 작성)
              </h4>
              
              {/* 1번 슬롯 */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1 font-bold">대체 근무일 (1)</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs text-gray-500 mb-1 font-bold">근무 시간 (1)</label>
                  <div className="flex items-center gap-2">
                    <input type="time" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
                    <span className="text-gray-400">~</span>
                    <input type="time" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
                  </div>
                </div>
              </div>

              {/* 구분선 */}
              <div className="border-t border-gray-200 border-dashed"></div>

              {/* 2번 슬롯 */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1 font-bold">대체 근무일 (2)</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs text-gray-500 mb-1 font-bold">근무 시간 (2)</label>
                  <div className="flex items-center gap-2">
                    <input type="time" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
                    <span className="text-gray-400">~</span>
                    <input type="time" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
                  </div>
                </div>
              </div>
            </div>
            {/* ▲▲▲ 대체휴무 상세 끝 ▲▲▲ */}

            {/* 파일 첨부 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">증빙 서류 첨부</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                <span className="text-sm">클릭하여 파일을 업로드하거나 드래그하세요</span>
                <span className="text-xs text-gray-400 mt-1">(진단서, 청첩장 등)</span>
              </div>
            </div>

          </section>
        </div>

        {/* 3. 푸터 (버튼) */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button 
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            결재 상신
          </button>
        </div>

      </div>
    </div>
  );
}
