"use client";

import { useState } from "react";
import { Clock, Calendar, Building2, User, ChevronDown, ChevronRight } from "lucide-react";
// ⭐️ 실제 경로와 컴포넌트명에 맞게 import 해주세요
import LeaveApplicationModal from "@/components/LeaveApplicationModal";
import OvertimeApplicationModal from "@/components/OvertimeApplicationModal";

interface Props {
  sortedDepts: string[];
  grouped: Record<string, Record<string, { requester: any; lines: any[] }>>;
  empSortMap: Map<string, number>;
}

export default function ApproverHistoryClient({ sortedDepts, grouped, empSortMap }: Props) {
  const [selectedLeave, setSelectedLeave] = useState<any | null>(null);
  const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);

  const formatTime = (timeStr?: string) => timeStr ? timeStr.substring(0, 5) : '';

  return (
    <>
      {sortedDepts.length > 0 ? (
        sortedDepts.map(dept => {
          const sortedEmployees = Object.values(grouped[dept]).sort((a, b) => {
            const orderA = empSortMap.get(a.requester.id) ?? 99;
            const orderB = empSortMap.get(b.requester.id) ?? 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.requester.name.localeCompare(b.requester.name);
          });

          return (
            <div key={dept} className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b border-gray-200 pb-2">
                <Building2 className="w-5 h-5 text-gray-400" /> 
                {dept}
                <span className="text-sm font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                  {sortedEmployees.length}명
                </span>
              </h2>

              <div className="grid grid-cols-1 gap-4">
                {sortedEmployees.map(({ requester, lines: empLines }) => (
                  <details key={requester.id} className="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" open>
                    {/* 아코디언 헤더 (직원 정보) */}
                    <summary className="bg-white hover:bg-gray-50 px-5 py-4 flex items-center justify-between cursor-pointer list-none transition-colors border-b border-transparent group-open:border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                          {requester.avatar_url ? (
                            <img src={requester.avatar_url} alt={requester.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 flex items-center gap-2">
                            {requester.name}
                            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                              {requester.position || "직급없음"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>총 <span className="font-bold text-blue-600">{empLines.length}</span>건</span>
                        <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
                      </div>
                    </summary>

                    {/* ⭐️ 카드형 결재 내역 리스트 (캡처 화면 스타일 적용) */}
                    <div className="p-4 sm:p-5 bg-gray-50/50 flex flex-col gap-4">
                      {empLines.map((line: any) => {
                        const isApproved = line.status === "approved";
                        const reqType = line.req.request_type?.toLowerCase() || 'create';
                        
                        // 배지 스타일 분기
                        let badgeText = '신청';
                        let badgeClass = 'bg-green-50 text-green-600';
                        if (reqType === 'cancel') {
                          badgeText = '취소';
                          badgeClass = 'bg-red-50 text-red-600';
                        } else if (reqType === 'update') {
                          badgeText = '변경';
                          badgeClass = 'bg-orange-50 text-orange-600';
                        }

                        return (
                          <div 
                            key={line.id} 
                            onClick={() => line.isLeave ? setSelectedLeave(line.req) : setSelectedOvertime(line.req)}
                            className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group/card"
                          >
                            {/* 카드 상단 회색 헤더 영역 */}
                            <div className="bg-gray-50/80 px-4 py-2.5 text-xs font-bold text-gray-500 border-b border-gray-100 flex items-center gap-2">
                              {line.isLeave ? <Calendar className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                              {line.isLeave ? `${line.req.leave_type} 결재 내역` : '초과근무 결재 내역'}
                            </div>

                            {/* 카드 본문 영역 */}
                            <div className="p-4 sm:p-5 relative">
                              {/* 좌측 포인트 컬러 점 */}
                              <div 
                                className="absolute left-4 sm:left-5 top-5 sm:top-6 w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: line.isLeave ? '#3b82f6' : '#f97316' }}
                              />

                              <div className="pl-4 sm:pl-5">
                                <div className="flex justify-between items-start gap-4">
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    {/* 상태 배지 (신청/취소/변경) */}
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${badgeClass}`}>
                                      {badgeText}
                                    </span>
                                    
                                    {/* 메인 타이틀 (날짜 또는 제목) */}
                                    <span className="font-bold text-gray-900 text-base">
                                      {line.isLeave ? (
                                        line.req.start_time && line.req.end_time 
                                          ? `${line.req.start_date} ${formatTime(line.req.start_time)} ~ ${formatTime(line.req.end_time)}`
                                          : `${line.req.start_date} ~ ${line.req.end_date}`
                                      ) : (
                                        line.req.title || `초과근무신청서_${line.req.work_date}`
                                      )}
                                    </span>
                                  </div>

                                  {/* 우측 승인/반려 상태 텍스트 */}
                                  <div className={`flex items-center text-sm font-bold shrink-0 ${isApproved ? 'text-blue-600' : 'text-red-500'}`}>
                                    {isApproved ? '승인' : '반려'} 
                                    <ChevronRight className="w-4 h-4 ml-0.5 text-gray-400 group-hover/card:translate-x-1 group-hover/card:text-blue-500 transition-all" />
                                  </div>
                                </div>

                                {/* 상세 정보 (초과근무일 경우 시간 표시) */}
                                {!line.isLeave && (
                                  <div className="mt-2 text-sm text-gray-500 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {line.req.work_date} ({formatTime(line.req.start_time)}~{formatTime(line.req.end_time)})
                                  </div>
                                )}

                                {/* 코멘트가 있을 경우 */}
                                {line.comment && (
                                  <div className="mt-3 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg flex items-start gap-2 border border-gray-100">
                                    <span className="shrink-0 text-gray-400 text-xs mt-0.5">💬</span>
                                    <span>{line.comment}</span>
                                  </div>
                                )}

                                {/* 하단 결재일자 및 부가정보 */}
                                <div className="mt-4 flex items-center justify-between">
                                  <div className="text-xs text-gray-400">
                                    {line.decided_at ? `${new Date(line.decided_at).toLocaleDateString('ko-KR')} 결재완료` : '-'}
                                  </div>
                                  {/* 휴가일 경우 우측 하단에 연차 종류 표시 */}
                                  {line.isLeave && (
                                    <div className="text-sm font-bold text-gray-700">
                                      {line.req.leave_type}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <p className="text-gray-500 font-medium">아직 처리한 결재 내역이 없습니다.</p>
        </div>
      )}

      {selectedLeave && (
        <LeaveApplicationModal isOpen={!!selectedLeave} onClose={() => setSelectedLeave(null)} initialData={selectedLeave} />
      )}
      {selectedOvertime && (
        <OvertimeApplicationModal isOpen={!!selectedOvertime} onClose={() => setSelectedOvertime(null)} initialData={selectedOvertime} />
      )}
    </>
  );
}
