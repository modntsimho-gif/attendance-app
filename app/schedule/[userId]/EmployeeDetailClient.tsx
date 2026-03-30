"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, Clock, ChevronRight, History, GitCommit, Link2, UserCheck, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import LeaveApplicationModal from "@/components/LeaveApplicationModal"; 
import OvertimeApplicationModal from "@/components/OvertimeApplicationModal"; 

interface EmployeeDetailClientProps {
  profile: any;
  leaves: any[];
  overtimes: any[];
  allocations: any[]; 
}

// 그룹화 함수
const groupHistory = (data: any[], idField: string, parentField: string) => {
  if (!data || data.length === 0) return [];

  const itemMap = new Map<string, any>();
  const parentMap = new Map<string, string>();

  data.forEach((item) => {
    itemMap.set(item[idField], item);
    if (item[parentField]) {
      parentMap.set(item[idField], item[parentField]);
    }
  });

  const findRootId = (currentId: string): string => {
    let pointer = currentId;
    while (parentMap.has(pointer)) {
      const parentId = parentMap.get(pointer)!;
      if (!itemMap.has(parentId)) break; 
      pointer = parentId;
    }
    return pointer;
  };

  const groups: Record<string, any[]> = {};
  data.forEach((item) => {
    const rootId = findRootId(item[idField]);
    if (!groups[rootId]) groups[rootId] = [];
    groups[rootId].push(item);
  });

  const result = Object.values(groups).map((group) => {
    return group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

  return result.sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime());
};

export default function EmployeeDetailClient({ profile, leaves, overtimes, allocations }: EmployeeDetailClientProps) {
  const currentYear = new Date().getFullYear();
  
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  const [selectedOvertime, setSelectedOvertime] = useState<any>(null);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);

  const { filteredLeaves, filteredOvertimes, yearStats } = useMemo(() => {
    const yearStr = selectedYear.toString();

    const leavesInYear = leaves.filter(l => l.start_date && l.start_date.startsWith(yearStr));
    const overtimesInYear = overtimes.filter(o => o.work_date && o.work_date.startsWith(yearStr));

    const allocData = allocations.find(a => a.year === selectedYear);
    let totalAnnualLeave = 0;
    
    if (allocData) {
      totalAnnualLeave = allocData.total_days;
    } else if (selectedYear === currentYear) {
      totalAnnualLeave = profile.total_leave_days || 0;
    }

    let usedAnnualLeave = leavesInYear
      .filter(l => 
        l.status === 'approved' && 
        (
          l.leave_type === '연차' || 
          l.leave_type === 'annual' || 
          l.leave_type === '반차' || 
          l.leave_type === '반반차'
        )
      )
      .reduce((sum, l) => sum + Number(l.total_leave_days), 0);

    if (selectedYear === currentYear) {
      const profileUsed = Number(profile.used_leave_days || 0);
      if (profileUsed > usedAnnualLeave) {
        usedAnnualLeave = profileUsed;
      }
    }
    return {
      filteredLeaves: leavesInYear,
      filteredOvertimes: overtimesInYear,
      yearStats: {
        total: totalAnnualLeave,
        used: usedAnnualLeave,
        remaining: totalAnnualLeave - usedAnnualLeave
      }
    };
  }, [selectedYear, leaves, overtimes, allocations, profile, currentYear]);

  const groupedLeaves = useMemo(() => groupHistory(filteredLeaves, 'id', 'original_leave_request_id'), [filteredLeaves]);
  const groupedOvertimes = useMemo(() => groupHistory(filteredOvertimes, 'id', 'original_overtime_request_id'), [filteredOvertimes]);

  const handleLeaveClick = (item: any) => {
    setSelectedLeave(item);
    setIsLeaveModalOpen(true);
  };

  const handleOvertimeClick = (item: any) => {
    setSelectedOvertime(item);
    setIsOvertimeModalOpen(true);
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case "approved": return <span className="text-blue-600 font-bold text-xs">승인</span>;
      case "rejected": return <span className="text-red-600 font-bold text-xs">반려</span>;
      case "cancelled": return <span className="text-gray-500 font-bold text-xs">취소됨</span>;
      default: return <span className="text-yellow-600 font-bold text-xs">대기</span>;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'create': return '신청';
      case 'update': return '변경';
      case 'cancel': return '취소';
      default: return '신청';
    }
  };

  const availableYears = Array.from(new Set([
    currentYear,
    ...allocations.map(a => a.year),
    ...leaves.map(l => parseInt(l.start_date.split('-')[0]))
  ])).sort((a, b) => b - a);

  return (
    <>
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* 헤더 */}
          <div>
            <Link href="/schedule" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> 목록으로 돌아가기
            </Link>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl">
                  {profile.name.slice(0, 1)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
                  <p className="text-gray-500">{profile.department} · {profile.position}</p>
                  <div className="text-xs text-gray-400 mt-1">입사일: {profile.join_date || '-'}</div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-end md:items-center">
                
                <div className="relative">
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 pl-4 pr-10 rounded-lg font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}년</option>
                    ))}
                  </select>
                  <Filter className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                  <div className="flex-1 md:flex-none bg-blue-50 p-4 rounded-lg border border-blue-100 text-center min-w-[140px]">
                    <div className="text-xs text-blue-600 font-bold mb-1">{selectedYear}년 잔여 연차</div>
                    <div className="text-xl font-bold text-gray-800">
                      {Number(yearStats.remaining).toFixed(2)}
                      <span className="text-xs font-normal text-gray-400 ml-1">/ {Number(yearStats.total).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex-1 md:flex-none bg-orange-50 p-4 rounded-lg border border-orange-100 text-center min-w-[140px]">
                    <div className="text-xs text-orange-600 font-bold mb-1">현재 잔여 보상휴가</div>
                    <div className="text-xl font-bold text-gray-800">
                      {Number(profile.extra_leave_days - profile.extra_used_leave_days).toFixed(2).replace(/\.0$/, '')}
                      <span className="text-xs font-normal text-gray-400 ml-1">/ {Number(profile.extra_leave_days).toFixed(2).replace(/\.0$/, '')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. 휴가 신청 내역 */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                {selectedYear}년 휴가 사용 내역
              </h2>
              
              {groupedLeaves.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-200">
                  {selectedYear}년도 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedLeaves.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                          <History className="w-3 h-3" /> 
                          History Group #{groupIdx + 1}
                        </span>
                        {group.length > 1 && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">총 {group.length}건의 기록</span>}
                      </div>

                      <div className="divide-y divide-gray-100">
                        {group.map((item, idx) => {
                          const isLatest = idx === 0;
                          
                          // ⭐️ [변경] 배열 형태의 overtime_request_ids를 순회하여 원천 초과근무 객체들을 찾습니다.
                          const sourceOvertimes = Array.isArray(item.overtime_request_ids) 
                            ? item.overtime_request_ids.map((id: string) => overtimes.find(ot => ot.id === id)).filter(Boolean)
                            : [];

                          return (
                            <div 
                              key={item.id} 
                              onClick={() => handleLeaveClick(item)}
                              className={`p-4 flex gap-4 cursor-pointer transition-colors hover:bg-blue-50/50 ${!isLatest ? 'bg-gray-50/30' : ''}`}
                            >
                              <div className="flex flex-col items-center pt-1">
                                <div className={`w-2 h-2 rounded-full ${isLatest ? 'bg-blue-500 ring-4 ring-blue-100' : 'bg-gray-300'}`}></div>
                                {idx !== group.length - 1 && <div className="w-0.5 h-full bg-gray-200 mt-1"></div>}
                              </div>

                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                                      item.request_type === 'create' ? 'bg-green-50 text-green-700 border-green-200' :
                                      item.request_type === 'update' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                      {getRequestTypeLabel(item.request_type)}
                                    </span>
                                    <span className={`text-sm font-bold ${isLatest ? 'text-gray-900' : 'text-gray-500'}`}>
                                      {item.start_date} ~ {item.end_date}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {renderStatus(item.status)}
                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                  </div>
                                </div>

                                <div className="text-sm text-gray-600 mb-2">
                                  <div className="truncate w-full text-xs text-gray-500 mb-1">{item.reason}</div>
                                  
                                  {/* ⭐️ [변경] 찾은 원천 초과근무 배열을 순회하며 뱃지를 여러 개 렌더링합니다. */}
                                  {sourceOvertimes.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-1">
                                      {sourceOvertimes.map((ot: any, i: number) => (
                                        <div 
                                          key={i}
                                          onClick={(e) => {
                                            e.stopPropagation(); 
                                            handleOvertimeClick(ot);
                                          }}
                                          className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 px-2 py-1 rounded text-xs font-medium hover:bg-orange-100 hover:border-orange-300 transition-colors group/link"
                                        >
                                          <Link2 className="w-3 h-3" />
                                          <span>원천: {ot.title}</span>
                                          <ChevronRight className="w-3 h-3 opacity-50 group-hover/link:opacity-100" />
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {item.approver_name && (
                                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 bg-gray-100/50 px-2 py-1 rounded w-fit">
                                      <UserCheck className="w-3 h-3 text-gray-400" />
                                      <span>결재: <span className="font-medium text-gray-700">{item.approver_name}</span></span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex justify-between items-end text-sm">
                                  <div className="text-[10px] text-gray-400">
                                    {new Date(item.created_at).toLocaleDateString()} 신청
                                  </div>
                                  <div className={`font-bold ${item.request_type === 'cancel' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                    -{Number(item.total_leave_days).toFixed(2)}일
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2. 초과근무 내역 */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                {selectedYear}년 초과근무 이력
              </h2>
              
              {groupedOvertimes.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-200">
                  {selectedYear}년도 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedOvertimes.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                          <GitCommit className="w-3 h-3" /> 
                          History Group #{groupIdx + 1}
                        </span>
                        {group.length > 1 && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">총 {group.length}건의 기록</span>}
                      </div>

                      <div className="divide-y divide-gray-100">
                        {group.map((item, idx) => {
                          const isLatest = idx === 0;
                          return (
                            <div 
                              key={item.id} 
                              onClick={() => handleOvertimeClick(item)}
                              className={`p-4 flex gap-4 cursor-pointer transition-colors hover:bg-orange-50/50 ${!isLatest ? 'bg-gray-50/30' : ''}`}
                            >
                              <div className="flex flex-col items-center pt-1">
                                <div className={`w-2 h-2 rounded-full ${isLatest ? 'bg-orange-500 ring-4 ring-orange-100' : 'bg-gray-300'}`}></div>
                                {idx !== group.length - 1 && <div className="w-0.5 h-full bg-gray-200 mt-1"></div>}
                              </div>

                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                                      item.request_type === 'create' ? 'bg-green-50 text-green-700 border-green-200' :
                                      item.request_type === 'update' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                      {getRequestTypeLabel(item.request_type)}
                                    </span>
                                    <span className={`text-sm font-bold ${isLatest ? 'text-gray-900' : 'text-gray-500'}`}>
                                      {item.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {renderStatus(item.status)}
                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                  </div>
                                </div>

                                <div className="text-sm text-gray-600 mb-2">
                                  <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                                    <Calendar className="w-3 h-3" />
                                    {item.work_date} ({item.start_time.slice(0,5)}~{item.end_time.slice(0,5)})
                                  </div>
                                  
                                  {item.approver_name && (
                                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500 bg-gray-100/50 px-2 py-1 rounded w-fit">
                                      <UserCheck className="w-3 h-3 text-gray-400" />
                                      <span>결재: <span className="font-medium text-gray-700">{item.approver_name}</span></span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex justify-between items-end text-sm">
                                  <div className="text-[10px] text-gray-400">
                                    {new Date(item.created_at).toLocaleDateString()} 신청
                                  </div>
                                  <div className={`font-bold ${item.request_type === 'cancel' ? 'text-gray-400 line-through' : 'text-blue-600'}`}>
                                    +{Number(Number(item.recognized_hours) / 8).toFixed(2)}일
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        </div>
      </main>

      <LeaveApplicationModal 
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        initialData={selectedLeave}
      />

      <OvertimeApplicationModal
        isOpen={isOvertimeModalOpen}
        onClose={() => setIsOvertimeModalOpen(false)}
        initialData={selectedOvertime}
      />
    </>
  );
}
