"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Search, CornerDownRight, Link2 } from "lucide-react";
import LeaveApplicationModal from "@/components/LeaveApplicationModal"; 
import OvertimeApplicationModal from "@/components/OvertimeApplicationModal"; 

interface EmployeeDetailClientProps {
  profile: any;
  leaves: any[];
  overtimes: any[];
  allocations: any[]; 
}

const renderLeaveTypeBadge = (type: string) => {
  if (!type) return <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[11px] font-bold">-</span>;
  
  let bgColor = "bg-gray-100";
  let textColor = "text-gray-700";
  let borderColor = "border-gray-200";

  if (type.includes('연차') || type.includes('반차')) {
    // 1. 연차 계열 (연차, 반차, 반반차): 파란색
    bgColor = "bg-blue-50"; textColor = "text-blue-700"; borderColor = "border-blue-200";
  } else if (type.includes('대체휴무')) {
    // 2. 대체휴무 계열 (전일, 반일, 반반일): 오렌지색
    bgColor = "bg-orange-50"; textColor = "text-orange-700"; borderColor = "border-orange-200";
  } else {
    // 3. 그 외 (경조, 공가, 출산휴가 등): 깔끔한 회색
    bgColor = "bg-gray-100"; textColor = "text-gray-700"; borderColor = "border-gray-200";
  }

  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${bgColor} ${textColor} ${borderColor}`}>
      {type}
    </span>
  );
};

const groupHistory = (data: any[], idField: string, parentField: string) => {
  if (!data || data.length === 0) return [];
  const itemMap = new Map<string, any>();
  const parentMap = new Map<string, string>();

  data.forEach((item) => {
    itemMap.set(item[idField], item);
    if (item[parentField]) parentMap.set(item[idField], item[parentField]);
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
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<'leave' | 'overtime'>('leave');
  const [showRemainingOvertimeOnly, setShowRemainingOvertimeOnly] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  const [selectedOvertime, setSelectedOvertime] = useState<any>(null);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);

  const { filteredLeaves, filteredOvertimes, currentYearStats } = useMemo(() => {
    let leavesList = leaves;
    let overtimesList = overtimes;

    if (startDate) {
      leavesList = leavesList.filter(l => l.start_date >= startDate);
      overtimesList = overtimesList.filter(o => o.work_date >= startDate);
    }
    if (endDate) {
      leavesList = leavesList.filter(l => l.start_date <= endDate);
      overtimesList = overtimesList.filter(o => o.work_date <= endDate);
    }

    // ⭐️ 잔여 시간 있는 초과근무만 보기 필터
    if (showRemainingOvertimeOnly) {
      overtimesList = overtimesList.filter(o => Number(o.recognized_hours) > Number(o.used_hours));
    }

    const allocData = allocations.find(a => a.year === currentYear);
    let totalAnnualLeave = allocData ? allocData.total_days : (profile.total_leave_days || 0);
    
    let usedAnnualLeave = leaves
      .filter(l => 
        l.start_date?.startsWith(currentYear.toString()) && 
        l.status === 'approved' && 
        ['연차', 'annual', '반차', '반반차'].includes(l.leave_type)
      )
      .reduce((sum, l) => sum + Number(l.total_leave_days), 0);

    const profileUsed = Number(profile.used_leave_days || 0);
    if (profileUsed > usedAnnualLeave) usedAnnualLeave = profileUsed;

    return {
      filteredLeaves: leavesList,
      filteredOvertimes: overtimesList,
      currentYearStats: {
        total: totalAnnualLeave,
        used: usedAnnualLeave,
        remaining: totalAnnualLeave - usedAnnualLeave
      }
    };
  }, [startDate, endDate, showRemainingOvertimeOnly, leaves, overtimes, allocations, profile, currentYear]);

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

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <span className="text-blue-600 font-bold">승인</span>;
      case "rejected": return <span className="text-red-600 font-bold">반려</span>;
      case "cancelled": return <span className="text-gray-400 font-bold">취소</span>;
      default: return <span className="text-yellow-600 font-bold">대기</span>;
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

  return (
    <>
      <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* 상단 뒤로가기 */}
          <Link href="/schedule" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> 목록으로
          </Link>

          {/* 프로필 & 요약 헤더 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl border border-indigo-100">
                {profile.name.slice(0, 1)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
                <p className="text-sm text-gray-500">{profile.department} · {profile.position}</p>
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex-1 md:flex-none bg-white p-3 rounded-lg border border-gray-200 text-center min-w-[120px]">
                <div className="text-xs text-gray-500 mb-1">올해 잔여 연차</div>
                <div className="text-lg font-bold text-gray-900">
                  {Number(currentYearStats.remaining).toFixed(2)}<span className="text-xs text-gray-400 ml-1">/ {Number(currentYearStats.total).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex-1 md:flex-none bg-white p-3 rounded-lg border border-gray-200 text-center min-w-[120px]">
                <div className="text-xs text-gray-500 mb-1">잔여 보상휴가</div>
                <div className="text-lg font-bold text-gray-900">
                  {Number(profile.extra_leave_days - profile.extra_used_leave_days).toFixed(2).replace(/\.0$/, '')}<span className="text-xs text-gray-400 ml-1">/ {Number(profile.extra_leave_days).toFixed(2).replace(/\.0$/, '')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 컨트롤 패널 (탭 & 필터) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex bg-white border border-gray-200 p-1 rounded-lg w-full sm:w-auto shadow-sm">
              <button
                className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-colors ${
                  activeTab === 'leave' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('leave')}
              >
                휴가 내역 ({groupedLeaves.length})
              </button>
              <button
                className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-colors ${
                  activeTab === 'overtime' ? 'bg-orange-50 text-orange-700' : 'text-gray-500 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('overtime')}
              >
                초과근무 이력 ({groupedOvertimes.length})
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
              
              {/* ⭐️ 초과근무 탭일 때만 보이는 '잔여 시간' 필터 체크박스 */}
              {activeTab === 'overtime' && (
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm hover:bg-orange-50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={showRemainingOvertimeOnly} 
                    onChange={(e) => setShowRemainingOvertimeOnly(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                  />
                  <span className="font-medium">잔여 시간 있는 건만</span>
                </label>
              )}

              {/* 날짜 필터 */}
              <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm w-full sm:w-auto">
                <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm outline-none text-gray-700 bg-transparent w-full"
                />
                <span className="text-gray-300 mx-2">~</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm outline-none text-gray-700 bg-transparent w-full"
                />
              </div>
            </div>
          </div>

          {/* 데이터 테이블 & 모바일 리스트 영역 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            
            {/* ==========================================
                🖥️ PC 뷰: 데이터 테이블 (md:block)
            ========================================== */}
            <div className="hidden md:block overflow-x-auto">
              
              {/* 1. 휴가 테이블 (PC) */}
              {activeTab === 'leave' && (
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <tr>
                      <th className="px-4 py-3 text-center w-[80px] min-w-[80px]">상태</th>
                      <th className="px-4 py-3 w-[100px] min-w-[100px]">구분</th>
                      <th className="px-4 py-3 w-[240px] min-w-[240px]">휴가 일자</th>
                      <th className="px-4 py-3 text-right w-[100px] min-w-[100px]">차감일수</th>
                      <th className="px-4 py-3 min-w-[250px]">사유</th>
                      <th className="px-4 py-3 w-[200px] min-w-[200px]">원천 초과근무</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedLeaves.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">데이터가 없습니다.</td></tr>
                    ) : (
                      groupedLeaves.map((group, groupIdx) => {
                        const latest = group[0];
                        const history = group.slice(1);
                        const sourceOvertimes = Array.isArray(latest.overtime_request_ids) 
                          ? latest.overtime_request_ids.map((id: string) => overtimes.find(ot => ot.id === id)).filter(Boolean)
                          : [];

                        return (
                          <React.Fragment key={groupIdx}>
                            <tr className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => handleLeaveClick(latest)}>
                              <td className="px-4 py-3.5 text-center">{renderStatusBadge(latest.status)}</td>
                              
                              {/* ⭐️ PC 뷰: 여기서 함수를 호출하도록 수정했습니다! */}
                              <td className="px-4 py-3.5 font-medium text-gray-900">
                                {renderLeaveTypeBadge(latest.leave_type)}
                              </td>

                              <td className="px-4 py-3.5 font-bold text-gray-900">{latest.start_date} ~ {latest.end_date}</td>
                              <td className={`px-4 py-3.5 text-right font-bold ${latest.request_type === 'cancel' ? 'text-gray-300 line-through' : 'text-gray-900'}`}>
                                -{Number(latest.total_leave_days).toFixed(2)}일
                              </td>
                              <td className="px-4 py-3.5 text-gray-600 truncate max-w-[250px]" title={latest.reason}>
                                {latest.reason || '-'}
                              </td>
                              <td className="px-4 py-3.5">
                                {sourceOvertimes.length > 0 ? (
                                  <div className="flex gap-1.5 flex-wrap">
                                    {sourceOvertimes.map((ot: any, i: number) => (
                                      <span key={i} className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 px-2 py-1 rounded-md text-xs font-bold hover:bg-orange-100 hover:border-orange-300 transition-all cursor-pointer" onClick={(e) => { e.stopPropagation(); handleOvertimeClick(ot); }}>
                                        <Link2 className="w-3.5 h-3.5" /> {ot.title}
                                      </span>
                                    ))}
                                  </div>
                                ) : <span className="text-gray-300">-</span>}
                              </td>
                            </tr>
                            {history.map((pastItem) => (
                              <tr key={pastItem.id} className="bg-gray-50/50 text-gray-400 text-xs hover:bg-gray-100/50 cursor-pointer transition-colors" onClick={() => handleLeaveClick(pastItem)}>
                                <td className="px-4 py-2 text-center opacity-60">{renderStatusBadge(pastItem.status)}</td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-1"><CornerDownRight className="w-3 h-3" /><span>{getRequestTypeLabel(pastItem.request_type)}</span></div>
                                </td>
                                <td className="px-4 py-2">{pastItem.start_date} ~ {pastItem.end_date}</td>
                                <td className="px-4 py-2 text-right">-{Number(pastItem.total_leave_days).toFixed(2)}일</td>
                                <td className="px-4 py-2 truncate max-w-[250px]">{pastItem.reason || '-'}</td>
                                <td className="px-4 py-2">-</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}

              {/* 2. 초과근무 테이블 (PC) - 기존과 동일 */}
              {activeTab === 'overtime' && (
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <tr>
                      <th className="px-4 py-3 text-center w-[80px] min-w-[80px]">상태</th>
                      <th className="px-4 py-3 w-[240px] min-w-[240px]">근무 일자</th>
                      <th className="px-4 py-3 text-right w-[100px] min-w-[100px]">발생일수</th>
                      <th className="px-4 py-3 text-right w-[100px] min-w-[100px]">사용일수</th>
                      <th className="px-4 py-3 min-w-[300px]">제목 / 사유</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedOvertimes.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">데이터가 없습니다.</td></tr>
                    ) : (
                      groupedOvertimes.map((group, groupIdx) => {
                        const latest = group[0];
                        const history = group.slice(1);

                        return (
                          <React.Fragment key={groupIdx}>
                            <tr className="hover:bg-orange-50/30 cursor-pointer transition-colors" onClick={() => handleOvertimeClick(latest)}>
                              <td className="px-4 py-3.5 text-center">{renderStatusBadge(latest.status)}</td>
                              <td className="px-4 py-3.5 font-bold text-gray-900">
                                {latest.work_date} <span className="text-gray-500 font-normal ml-1">({latest.start_time.slice(0,5)}~{latest.end_time.slice(0,5)})</span>
                              </td>
                              <td className={`px-4 py-3.5 text-right font-bold ${latest.request_type === 'cancel' ? 'text-gray-300 line-through' : 'text-blue-600'}`}>
                                +{Number(Number(latest.recognized_hours) / 8).toFixed(2)}일
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                {Number(latest.used_hours) > 0 ? (
                                  <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded text-xs">-{Number(Number(latest.used_hours) / 8).toFixed(2)}일</span>
                                ) : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="px-4 py-3.5 text-gray-700 truncate max-w-[350px]" title={latest.title}>{latest.title}</td>
                            </tr>
                            {history.map((pastItem) => (
                              <tr key={pastItem.id} className="bg-gray-50/50 text-gray-400 text-xs hover:bg-gray-100/50 cursor-pointer transition-colors" onClick={() => handleOvertimeClick(pastItem)}>
                                <td className="px-4 py-2 text-center opacity-60">{renderStatusBadge(pastItem.status)}</td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-1"><CornerDownRight className="w-3 h-3" /><span>{getRequestTypeLabel(pastItem.request_type)}</span></div>
                                </td>
                                <td className="px-4 py-2 text-right">+{Number(Number(pastItem.recognized_hours) / 8).toFixed(2)}일</td>
                                <td className="px-4 py-2 text-right">-</td>
                                <td className="px-4 py-2 truncate max-w-[350px]">{pastItem.title}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* ==========================================
                📱 모바일 뷰: 세로형 리스트 (md:hidden)
            ========================================== */}
            <div className="block md:hidden divide-y divide-gray-100">
              
              {/* 1. 휴가 리스트 (모바일) */}
              {activeTab === 'leave' && (
                groupedLeaves.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">데이터가 없습니다.</div>
                ) : (
                  groupedLeaves.map((group, groupIdx) => {
                    const latest = group[0];
                    const history = group.slice(1);
                    const sourceOvertimes = Array.isArray(latest.overtime_request_ids) 
                      ? latest.overtime_request_ids.map((id: string) => overtimes.find(ot => ot.id === id)).filter(Boolean)
                      : [];

                    return (
                      <div key={groupIdx} className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleLeaveClick(latest)}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            
                            {/* ⭐️ 모바일 뷰: 여기서도 함수를 호출하도록 수정했습니다! */}
                            {renderLeaveTypeBadge(latest.leave_type)}
                            
                            <span className="font-bold text-gray-900 text-sm">{latest.start_date} ~ {latest.end_date}</span>
                          </div>
                          <div className="shrink-0 ml-2">{renderStatusBadge(latest.status)}</div>
                        </div>
                        
                        <div className="text-sm text-gray-600 line-clamp-2 mb-3">{latest.reason || '사유 없음'}</div>
                        
                        <div className="flex justify-between items-end">
                          <div className="flex-1">
                            {sourceOvertimes.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {sourceOvertimes.map((ot: any, i: number) => (
                                  <span key={i} className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-bold" onClick={(e) => { e.stopPropagation(); handleOvertimeClick(ot); }}>
                                    <Link2 className="w-3 h-3" /> {ot.title}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className={`font-bold text-base shrink-0 ml-2 ${latest.request_type === 'cancel' ? 'text-gray-300 line-through' : 'text-gray-900'}`}>
                            -{Number(latest.total_leave_days).toFixed(2)}일
                          </div>
                        </div>

                        {/* 과거 이력 (모바일) */}
                        {history.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-dashed border-gray-100 space-y-1.5">
                            {history.map((pastItem) => (
                              <div key={pastItem.id} className="flex justify-between items-center text-xs text-gray-400" onClick={(e) => { e.stopPropagation(); handleLeaveClick(pastItem); }}>
                                <div className="flex items-center gap-1">
                                  <CornerDownRight className="w-3 h-3" />
                                  <span className="bg-gray-100 px-1 rounded text-[10px]">{getRequestTypeLabel(pastItem.request_type)}</span>
                                  <span>{pastItem.start_date} ~ {pastItem.end_date}</span>
                                </div>
                                <div>-{Number(pastItem.total_leave_days).toFixed(2)}일</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              )}

              {/* 2. 초과근무 리스트 (모바일) - 기존과 동일 */}
              {activeTab === 'overtime' && (
                groupedOvertimes.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">데이터가 없습니다.</div>
                ) : (
                  groupedOvertimes.map((group, groupIdx) => {
                    const latest = group[0];
                    const history = group.slice(1);

                    return (
                      <div key={groupIdx} className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleOvertimeClick(latest)}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-gray-900 text-sm">{latest.work_date}</span>
                            <span className="text-xs text-gray-500">({latest.start_time.slice(0,5)}~{latest.end_time.slice(0,5)})</span>
                          </div>
                          <div className="shrink-0 ml-2">{renderStatusBadge(latest.status)}</div>
                        </div>
                        
                        <div className="text-sm text-gray-700 line-clamp-2 mb-3">{latest.title}</div>
                        
                        <div className="flex justify-between items-end">
                          <div className="flex-1">
                            {Number(latest.used_hours) > 0 && (
                              <span className="text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded text-[10px]">
                                사용 -{Number(Number(latest.used_hours) / 8).toFixed(2)}일
                              </span>
                            )}
                          </div>
                          <div className={`font-bold text-base shrink-0 ml-2 ${latest.request_type === 'cancel' ? 'text-gray-300 line-through' : 'text-blue-600'}`}>
                            +{Number(Number(latest.recognized_hours) / 8).toFixed(2)}일
                          </div>
                        </div>

                        {/* 과거 이력 (모바일) */}
                        {history.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-dashed border-gray-100 space-y-1.5">
                            {history.map((pastItem) => (
                              <div key={pastItem.id} className="flex justify-between items-center text-xs text-gray-400" onClick={(e) => { e.stopPropagation(); handleOvertimeClick(pastItem); }}>
                                <div className="flex items-center gap-1">
                                  <CornerDownRight className="w-3 h-3" />
                                  <span className="bg-gray-100 px-1 rounded text-[10px]">{getRequestTypeLabel(pastItem.request_type)}</span>
                                  <span className="truncate max-w-[120px]">{pastItem.title}</span>
                                </div>
                                <div>+{Number(Number(pastItem.recognized_hours) / 8).toFixed(2)}일</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              )}

            </div>
          </div>
        </div>
      </main>

      <LeaveApplicationModal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} initialData={selectedLeave} />
      <OvertimeApplicationModal isOpen={isOvertimeModalOpen} onClose={() => setIsOvertimeModalOpen(false)} initialData={selectedOvertime} />
    </>
  );
}
