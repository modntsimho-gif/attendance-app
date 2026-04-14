"use client";

import { useState, useMemo } from "react";
import { Clock, Calendar, Building2, MessageSquare, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
// ⭐️ 실제 경로와 컴포넌트명에 맞게 import 해주세요
import LeaveApplicationModal from "@/components/LeaveApplicationModal";
import OvertimeApplicationModal from "@/components/OvertimeApplicationModal";

interface Props {
  sortedDepts: string[];
  grouped: Record<string, Record<string, { requester: any; lines: any[] }>>;
  empSortMap: Map<string, number>;
}

const renderStatusBadge = (status: string) => {
  if (status === 'approved') return <span className="text-blue-600 font-bold">승인</span>;
  if (status === 'rejected') return <span className="text-red-600 font-bold">반려</span>;
  return <span className="text-gray-500 font-bold">대기</span>;
};

const renderReqTypeBadge = (type: string) => {
  const t = type?.toLowerCase() || 'create';
  if (t === 'cancel') return <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded text-[11px] font-bold">취소</span>;
  if (t === 'update') return <span className="bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded text-[11px] font-bold">변경</span>;
  return <span className="bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded text-[11px] font-bold">신청</span>;
};

const getWeekRange = (offset: number) => {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
  
  const start = new Date(now.setDate(diffToMonday));
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export default function ApproverHistoryClient({ sortedDepts, grouped, empSortMap }: Props) {
  const [selectedLeave, setSelectedLeave] = useState<any | null>(null);
  const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchName, setSearchName] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");

  const formatTime = (timeStr?: string) => timeStr ? timeStr.substring(0, 5) : '';

  const { filteredData, weekStart, weekEnd } = useMemo(() => {
    const { start: wStart, end: wEnd } = getWeekRange(weekOffset);
    const isCustomDateRange = searchStartDate || searchEndDate;

    const data = sortedDepts.map(dept => {
      const employees = Object.values(grouped[dept])
        .filter(emp => {
          if (!searchName) return true;
          return emp.requester.name.includes(searchName);
        })
        .map(emp => {
          const filteredLines = emp.lines.filter(line => {
            if (!line.req.created_at) return false;
            const d = new Date(line.req.created_at);
            const time = d.getTime();
            
            if (isCustomDateRange) {
              let isValid = true;
              if (searchStartDate) {
                const s = new Date(searchStartDate);
                s.setHours(0, 0, 0, 0);
                if (time < s.getTime()) isValid = false;
              }
              if (searchEndDate) {
                const e = new Date(searchEndDate);
                e.setHours(23, 59, 59, 999);
                if (time > e.getTime()) isValid = false;
              }
              return isValid;
            } else {
              return time >= wStart.getTime() && time <= wEnd.getTime();
            }
          });
          return { ...emp, lines: filteredLines };
        })
        .filter(emp => emp.lines.length > 0)
        .sort((a, b) => {
          const orderA = empSortMap.get(a.requester.id) ?? 99;
          const orderB = empSortMap.get(b.requester.id) ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.requester.name.localeCompare(b.requester.name);
        });

      return { dept, employees };
    }).filter(d => d.employees.length > 0);

    return { filteredData: data, weekStart: wStart, weekEnd: wEnd };
  }, [sortedDepts, grouped, empSortMap, weekOffset, searchName, searchStartDate, searchEndDate]);

  return (
    <div className="space-y-6">
      
      {/* 상단 종합 필터 영역 */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        
        {/* 주간 이동 컨트롤러 */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setWeekOffset(prev => prev - 1)} 
            disabled={!!(searchStartDate || searchEndDate)}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center min-w-[160px]">
            {(searchStartDate || searchEndDate) ? (
              <>
                <div className="font-bold text-blue-600 text-base">기간 조회 중</div>
                <div className="text-xs text-gray-500 mt-0.5 font-medium">
                  {searchStartDate || '처음'} ~ {searchEndDate || '현재'}
                </div>
              </>
            ) : (
              <>
                <div className="font-bold text-gray-800 text-base">
                  {weekOffset === 0 ? "이번 주" : weekOffset === -1 ? "지난 주" : weekOffset === 1 ? "다음 주" : `${Math.abs(weekOffset)}주 ${weekOffset > 0 ? '후' : '전'}`}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 font-medium">
                  {weekStart.toLocaleDateString('ko-KR')} ~ {weekEnd.toLocaleDateString('ko-KR')}
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => setWeekOffset(prev => prev + 1)} 
            disabled={!!(searchStartDate || searchEndDate)}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* 기안자 & 기간 검색 */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full xl:w-auto">
          <div className="relative flex-1 min-w-[120px] max-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            {/* ⭐️ 텍스트 색상(text-gray-900)과 배경색(bg-white) 명시적 지정 */}
            <input 
              type="text" 
              placeholder="기안자 검색" 
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          
          {/* 기간 선택 (Start ~ End) */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            {/* ⭐️ 날짜 입력창 텍스트 색상 명시적 지정 */}
            <input 
              type="date" 
              value={searchStartDate}
              onChange={(e) => setSearchStartDate(e.target.value)}
              className="w-[115px] px-1 py-1 text-sm text-gray-900 bg-white focus:outline-none"
            />
            <span className="text-gray-400 text-sm">~</span>
            <input 
              type="date" 
              value={searchEndDate}
              onChange={(e) => setSearchEndDate(e.target.value)}
              className="w-[115px] px-1 py-1 text-sm text-gray-900 bg-white focus:outline-none"
            />
          </div>

          {(searchName || searchStartDate || searchEndDate) && (
            <button 
              onClick={() => { setSearchName(""); setSearchStartDate(""); setSearchEndDate(""); setWeekOffset(0); }}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
              title="필터 초기화"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 필터링된 데이터 렌더링 */}
      {filteredData.length > 0 ? (
        filteredData.map(({ dept, employees }) => {
          const totalDeptLines = employees.reduce((acc, curr) => acc + curr.lines.length, 0);

          return (
            <div key={dept} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-400" /> 
                  {dept}
                </h2>
                <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                  총 <span className="text-blue-600 font-bold">{totalDeptLines}</span>건
                </span>
              </div>

              {/* 🖥️ PC 뷰 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-500 font-medium">
                    <tr>
                      <th className="px-5 py-3 w-[120px]">기안자</th>
                      <th className="px-5 py-3 w-[100px]">구분</th>
                      <th className="px-5 py-3 w-[80px]">유형</th>
                      <th className="px-5 py-3 w-[220px]">사용기간</th>
                      <th className="px-5 py-3 min-w-[200px]">사유</th>
                      <th className="px-5 py-3 w-[100px]">상신일</th>
                      <th className="px-5 py-3 w-[80px] text-center">상태</th>
                      <th className="px-5 py-3 w-[120px]">결재일시</th>
                    </tr>
                  </thead>
                  {employees.map(({ requester, lines }) => {
                    const sortedLines = [...lines].sort((a, b) => {
                      const dateA = new Date(a.req.created_at || 0).getTime();
                      const dateB = new Date(b.req.created_at || 0).getTime();
                      return dateB - dateA;
                    });

                    return (
                      <tbody key={requester.id} className="divide-y divide-gray-100 border-b border-gray-200 last:border-b-0">
                        {sortedLines.map((item: any, idx: number) => (
                          <tr 
                            key={item.id} 
                            onClick={() => item.isLeave ? setSelectedLeave(item.req) : setSelectedOvertime(item.req)}
                            className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                          >
                            {idx === 0 && (
                              <td 
                                className="px-5 py-4 align-top border-r border-gray-100 bg-white/50" 
                                rowSpan={sortedLines.length}
                              >
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-bold text-gray-900">{requester.name}</span>
                                  <span className="text-xs text-gray-500">{requester.position}</span>
                                </div>
                              </td>
                            )}
                            
                            <td className="px-5 py-3.5">
                              {item.isLeave ? (
                                <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md text-xs font-bold w-fit">
                                  <Calendar className="w-3.5 h-3.5"/> {item.req.leave_type}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-orange-700 bg-orange-50 border border-orange-100 px-2 py-1 rounded-md text-xs font-bold w-fit">
                                  <Clock className="w-3.5 h-3.5"/> 초과근무
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">{renderReqTypeBadge(item.req.request_type)}</td>
                            
                            <td className="px-5 py-3.5 font-bold text-gray-900">
                              {item.isLeave ? (
                                item.req.start_time && item.req.end_time 
                                  ? `${item.req.start_date} ${formatTime(item.req.start_time)} ~ ${formatTime(item.req.end_time)}`
                                  : `${item.req.start_date} ~ ${item.req.end_date}`
                              ) : (
                                `${item.req.work_date} (${formatTime(item.req.start_time)}~${formatTime(item.req.end_time)})`
                              )}
                            </td>

                            <td className="px-5 py-3.5">
                              <div className="text-gray-800 truncate max-w-[250px]">
                                {!item.isLeave && item.req.title && (
                                  <span className="font-bold mr-1.5">[{item.req.title}]</span>
                                )}
                                {item.req.reason || <span className="text-gray-400">-</span>}
                              </div>
                              {item.comment && (
                                <div className="text-xs text-gray-500 mt-1.5 flex items-start gap-1 bg-gray-50 p-1.5 rounded w-fit max-w-full truncate border border-gray-100">
                                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-gray-400" /> {item.comment}
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-gray-500 text-xs font-medium">
                              {item.req.created_at ? new Date(item.req.created_at).toLocaleDateString('ko-KR') : '-'}
                            </td>

                            <td className="px-5 py-3.5 text-center">{renderStatusBadge(item.status)}</td>
                            <td className="px-5 py-3.5 text-gray-500 text-xs font-medium">
                              {item.status === 'pending' ? '-' : (item.decided_at ? new Date(item.decided_at).toLocaleDateString('ko-KR') : '-')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    );
                  })}
                </table>
              </div>

              {/* 📱 모바일 뷰 */}
              <div className="block md:hidden">
                {employees.map(({ requester, lines }) => {
                  const sortedLines = [...lines].sort((a, b) => {
                    const dateA = new Date(a.req.created_at || 0).getTime();
                    const dateB = new Date(b.req.created_at || 0).getTime();
                    return dateB - dateA;
                  });

                  return (
                    <div key={requester.id} className="border-b border-gray-200 last:border-b-0">
                      <div className="bg-gray-100/50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                        <span className="font-bold text-gray-900">{requester.name}</span>
                        <span className="text-xs text-gray-500">{requester.position}</span>
                        <span className="ml-auto text-xs text-gray-400 font-medium">{sortedLines.length}건</span>
                      </div>
                      
                      <div className="divide-y divide-gray-100">
                        {sortedLines.map((item: any) => (
                          <div 
                            key={item.id} 
                            onClick={() => item.isLeave ? setSelectedLeave(item.req) : setSelectedOvertime(item.req)}
                            className="p-4 hover:bg-gray-50 cursor-pointer active:bg-gray-100 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {renderReqTypeBadge(item.req.request_type)}
                              </div>
                              <div className="shrink-0 ml-2">{renderStatusBadge(item.status)}</div>
                            </div>
                            
                            <div className="flex items-start gap-1.5 mb-1">
                              {item.isLeave ? (
                                <span className="text-blue-600 text-xs font-bold shrink-0 mt-0.5">[{item.req.leave_type}]</span>
                              ) : (
                                <span className="text-orange-600 text-xs font-bold shrink-0 mt-0.5">[초과근무]</span>
                              )}
                              <span className="text-sm text-gray-900 font-bold">
                                {item.isLeave ? (
                                  item.req.start_time && item.req.end_time 
                                    ? `${item.req.start_date} ${formatTime(item.req.start_time)} ~ ${formatTime(item.req.end_time)}`
                                    : `${item.req.start_date} ~ ${item.req.end_date}`
                                ) : (
                                  `${item.req.work_date} (${formatTime(item.req.start_time)}~${formatTime(item.req.end_time)})`
                                )}
                              </span>
                            </div>

                            <div className="text-sm text-gray-600 line-clamp-2 mb-2 pl-1">
                              {!item.isLeave && item.req.title && <span className="font-bold text-gray-700 mr-1">[{item.req.title}]</span>}
                              {item.req.reason || '사유 없음'}
                            </div>

                            {item.comment && (
                              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded flex items-start gap-1.5 mb-2 border border-gray-100">
                                <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
                                <span className="line-clamp-2">{item.comment}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between gap-2 text-xs text-gray-400 mt-2 font-medium">
                              <span>상신: {item.req.created_at ? new Date(item.req.created_at).toLocaleDateString('ko-KR') : '-'}</span>
                              <span>
                                {item.status !== 'pending' && item.decided_at 
                                  ? `${new Date(item.decided_at).toLocaleDateString('ko-KR')} 결재완료` 
                                  : '결재 대기 중'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">
            조건에 일치하는 결재 내역이 없습니다.
          </p>
        </div>
      )}

      {selectedLeave && (
        <LeaveApplicationModal isOpen={!!selectedLeave} onClose={() => setSelectedLeave(null)} initialData={selectedLeave} />
      )}
      {selectedOvertime && (
        <OvertimeApplicationModal isOpen={!!selectedOvertime} onClose={() => setSelectedOvertime(null)} initialData={selectedOvertime} />
      )}
    </div>
  );
}
