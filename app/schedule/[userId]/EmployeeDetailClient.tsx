"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Search, CornerDownRight, Link2 } from "lucide-react";
import LeaveApplicationModal from "@/components/LeaveApplicationModal"; 
import OvertimeApplicationModal from "@/components/OvertimeApplicationModal"; 

interface EmployeeDetailClientProps { profile: any; leaves: any[]; overtimes: any[]; allocations: any[]; }

const renderLeaveTypeBadge = (t: string) => {
  if (!t) return <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[11px] font-bold">-</span>;
  const isBlue = ['연차', '반차', '대체휴무'].some((k: string) => t.includes(k));
  return <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${isBlue ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>{t}</span>;
};

const renderRequestTypeBadge = (t: string) => {
  const isC = t === 'cancel', isU = t === 'update';
  return <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${isC ? 'bg-red-50 text-red-600 border-red-200' : isU ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-green-50 text-green-600 border-green-200'}`}>{isC ? '취소' : isU ? '변경' : '신청'}</span>;
};

const renderHolidayBadge = (isHoliday: boolean) => {
  return isHoliday 
    ? <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-600 border border-red-200">휴일</span>
    : <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-50 text-gray-500 border border-gray-200">평일</span>;
};

const renderStatusBadge = (s: string) => {
  const isA = s === 'approved', isR = s === 'rejected', isC = s === 'cancelled';
  return <span className={`font-bold ${isA ? 'text-blue-600' : isR ? 'text-red-600' : isC ? 'text-gray-400' : 'text-yellow-600'}`}>{isA ? '승인' : isR ? '반려' : isC ? '취소' : '대기'}</span>;
};

const renderApprovers = (lines: any[]) => {
  if (!lines || !Array.isArray(lines) || lines.length === 0) return <span className="text-gray-300">-</span>;
  const sorted = [...lines].sort((a, b) => a.step_order - b.step_order);
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {sorted.map((l, idx) => {
        const name = l.profiles?.name || '알수없음';
        const color = l.status === 'approved' ? 'text-blue-600' : l.status === 'rejected' ? 'text-red-600' : 'text-gray-500';
        return (
          <div key={idx} className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-gray-400">[{l.step_order}차]</span>
            <span className={color}>{name}</span>
          </div>
        );
      })}
    </div>
  );
};

const getReqLabel = (t: string) => t === 'cancel' ? '취소' : t === 'update' ? '변경' : '신청';

const groupHistory = (data: any[], idF: string, pF: string): any[][] => {
  if (!data || data.length === 0) return [];
  const iMap = new Map<string, any>();
  const pMap = new Map<string, string>();
  data.forEach((i: any) => { iMap.set(i[idF], i); if (i[pF]) pMap.set(i[idF], i[pF]); });
  
  const getRoot = (id: string): string => pMap.has(id) && iMap.has(pMap.get(id)!) ? getRoot(pMap.get(id)!) : id;
  
  const grps: Record<string, any[]> = {};
  data.forEach((i: any) => { const r = getRoot(i[idF]); (grps[r] = grps[r] || []).push(i); });
  
  return Object.values(grps)
    .map((g: any[]) => g.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    .sort((a: any[], b: any[]) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime());
};

export default function EmployeeDetailClient({ profile, leaves, overtimes, allocations }: EmployeeDetailClientProps) {
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<'leave' | 'overtime'>('leave');
  const [showRemainingOvertimeOnly, setShowRemainingOvertimeOnly] = useState(false);
  const [showAnnualLeaveOnly, setShowAnnualLeaveOnly] = useState(false);
  const [excludeCancelled, setExcludeCancelled] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [selectedOvertime, setSelectedOvertime] = useState<any>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);

  
  const { filteredLeaves, filteredOvertimes, currentYearStats } = useMemo(() => {
    const fL = leaves.filter((l: any) => {
      const matchDate = (!startDate || l.start_date >= startDate) && (!endDate || l.start_date <= endDate);
      const matchType = !showAnnualLeaveOnly || ['연차', 'annual', '반차', '반반차'].includes(l.leave_type);
      return matchDate && matchType;
    });
    const fO = overtimes.filter((o: any) => (!startDate || o.work_date >= startDate) && (!endDate || o.work_date <= endDate) && (!showRemainingOvertimeOnly || Number(o.recognized_hours) > Number(o.used_hours)));
    
    const alloc = allocations.find((a: any) => a.year === currentYear);
    const total = alloc ? alloc.total_days : (profile.total_leave_days || 0);

    // ⭐️ 프로필 값(Math.max) 제거 & 취소건 제외 & 관리자 직권 신청건 포함
    const used = fL
      .filter((l: any) => {
        const isThisYear = l.start_date?.startsWith(currentYear.toString());
        const isApproved = l.status === 'approved';
        const isNotCancelled = l.request_type !== 'cancel'; // 취소 신청건 제외
        const isAnnualType = ['연차', 'annual', '반차', '반반차'].includes(l.leave_type);
        
        // 본인이 올린 것이든 관리자가 올린 것(l.requester_id !== profile.id)이든 
        // 위 조건만 맞으면 모두 합산됩니다.
        return isThisYear && isApproved && isNotCancelled && isAnnualType;
      })
      .reduce((sum: number, l: any) => sum + Number(l.total_leave_days), 0);

    return { filteredLeaves: fL, filteredOvertimes: fO, currentYearStats: { total, used, remaining: total - used } };
  }, [startDate, endDate, showRemainingOvertimeOnly, showAnnualLeaveOnly, leaves, overtimes, allocations, profile, currentYear]);

  const groupedLeaves = useMemo(() => {
    const groups = groupHistory(filteredLeaves, 'id', 'original_leave_request_id');
    if (!excludeCancelled) return groups;
    return groups.filter(g => g[0].request_type !== 'cancel' && g[0].status !== 'cancelled');
  }, [filteredLeaves, excludeCancelled]);

  const groupedOvertimes = useMemo(() => {
    const groups = groupHistory(filteredOvertimes, 'id', 'original_overtime_request_id');
    if (!excludeCancelled) return groups;
    return groups.filter(g => g[0].request_type !== 'cancel' && g[0].status !== 'cancelled');
  }, [filteredOvertimes, excludeCancelled]);

  return (
    <>
      <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Link href="/schedule" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium"><ArrowLeft className="w-4 h-4" /> 목록으로</Link>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl border border-indigo-100">{profile.name.slice(0, 1)}</div>
              <div><h1 className="text-xl font-bold text-gray-900">{profile.name}</h1><p className="text-sm text-gray-500">{profile.department} · {profile.position}</p></div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex-1 md:flex-none bg-white p-3 rounded-lg border border-gray-200 text-center min-w-[120px]">
                <div className="text-xs text-gray-500 mb-1">올해 잔여 연차</div>
                <div className="text-lg font-bold text-gray-900">{Number(currentYearStats.remaining).toFixed(2)}<span className="text-xs text-gray-400 ml-1">/ {Number(currentYearStats.total).toFixed(2)}</span></div>
              </div>
              <div className="flex-1 md:flex-none bg-white p-3 rounded-lg border border-gray-200 text-center min-w-[120px]">
                <div className="text-xs text-gray-500 mb-1">잔여 보상휴가</div>
                <div className="text-lg font-bold text-gray-900">{Number(profile.extra_leave_days - profile.extra_used_leave_days).toFixed(2).replace(/\.0$/, '')}<span className="text-xs text-gray-400 ml-1">/ {Number(profile.extra_leave_days).toFixed(2).replace(/\.0$/, '')}</span></div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex bg-white border border-gray-200 p-1 rounded-lg w-full sm:w-auto shadow-sm">
              <button className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'leave' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setActiveTab('leave')}>휴가 내역 ({groupedLeaves.length})</button>
              <button className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'overtime' ? 'bg-orange-50 text-orange-700' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setActiveTab('overtime')}>초과근무 이력 ({groupedOvertimes.length})</button>
            </div>
            
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
              
              <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
                {activeTab === 'leave' && (
                  <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs sm:text-sm text-gray-700 cursor-pointer bg-white border border-gray-200 px-2 sm:px-3 py-2 rounded-lg shadow-sm hover:bg-blue-50 transition-colors">
                    <input type="checkbox" checked={showAnnualLeaveOnly} onChange={(e) => setShowAnnualLeaveOnly(e.target.checked)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                    <span className="font-medium whitespace-nowrap">연차만 보기</span>
                  </label>
                )}
                {activeTab === 'overtime' && (
                  <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs sm:text-sm text-gray-700 cursor-pointer bg-white border border-gray-200 px-2 sm:px-3 py-2 rounded-lg shadow-sm hover:bg-orange-50 transition-colors">
                    <input type="checkbox" checked={showRemainingOvertimeOnly} onChange={(e) => setShowRemainingOvertimeOnly(e.target.checked)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer" />
                    <span className="font-medium whitespace-nowrap">잔여 시간만</span>
                  </label>
                )}
                
                <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs sm:text-sm text-gray-700 cursor-pointer bg-white border border-gray-200 px-2 sm:px-3 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={excludeCancelled} onChange={(e) => setExcludeCancelled(e.target.checked)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500 cursor-pointer" />
                  <span className="font-medium whitespace-nowrap">취소건 제외</span>
                </label>
              </div>

              <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm w-full sm:w-auto">
                <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm outline-none text-gray-900 bg-white w-full" />
                <span className="text-gray-300 mx-2">~</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm outline-none text-gray-900 bg-white w-full" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* 🖥️ PC 뷰 */}
            <div className="hidden md:block overflow-x-auto">
              {activeTab === 'leave' ? (
                <table className="w-full table-fixed text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <tr>
                      <th className="px-4 py-3 text-center w-[80px]">상태</th>
                      <th className="px-4 py-3 text-center w-[100px]">신청유형</th>
                      <th className="px-4 py-3 w-[100px]">휴가 종류</th>
                      <th className="px-4 py-3 w-[240px]">휴가 일자</th>
                      <th className="px-4 py-3 text-right w-[100px]">차감일수</th>
                      <th className="px-4 py-3 w-[120px]">결재자</th>
                      <th className="px-4 py-3">사유</th>
                      <th className="px-4 py-3 w-[200px]">원천 초과근무</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedLeaves.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">데이터가 없습니다.</td></tr> : groupedLeaves.map((group: any[], i: number) => {
                      const latest = group[0], history = group.slice(1);
                      const sourceOts = Array.isArray(latest.overtime_request_ids) ? latest.overtime_request_ids.map((id: string) => overtimes.find((ot: any) => ot.id === id)).filter(Boolean) : [];
                      return (
                        <React.Fragment key={i}>
                          <tr className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => { setSelectedLeave(latest); setIsLeaveModalOpen(true); }}>
                            <td className="px-4 py-3.5 text-center">{renderStatusBadge(latest.status)}</td>
                            <td className="px-4 py-3.5 text-center">{renderRequestTypeBadge(latest.request_type)}</td>
                            <td className="px-4 py-3.5 font-medium">{renderLeaveTypeBadge(latest.leave_type)}</td>
                            <td className="px-4 py-3.5 font-bold">{latest.start_date} ~ {latest.end_date}</td>
                            <td className={`px-4 py-3.5 text-right font-bold ${latest.request_type === 'cancel' ? 'text-gray-300 line-through' : 'text-gray-900'}`}>-{Number(latest.total_leave_days).toFixed(2)}일</td>
                            <td className="px-4 py-3.5">{renderApprovers(latest.approval_lines)}</td>
                            <td className="px-4 py-3.5 text-gray-600 truncate">{latest.reason || '-'}</td>
                            <td className="px-4 py-3.5">
                              {sourceOts.length > 0 ? (
                                <div className="flex flex-col gap-1.5 items-start">
                                  {sourceOts.map((ot: any, idx: number) => (
                                    <span key={idx} className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 px-2 py-1 rounded-md text-xs font-bold hover:bg-orange-100 transition-all max-w-full" onClick={(e) => { e.stopPropagation(); setSelectedOvertime(ot); setIsOvertimeModalOpen(true); }}>
                                      <Link2 className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">{ot.title}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : <span className="text-gray-300">-</span>}
                            </td>
                          </tr>
                          {history.map((h: any) => (
                            <tr key={h.id} className="bg-gray-50/50 text-gray-400 text-xs hover:bg-gray-100/50 cursor-pointer transition-colors" onClick={() => { setSelectedLeave(h); setIsLeaveModalOpen(true); }}>
                              <td className="px-4 py-2 text-center opacity-60">{renderStatusBadge(h.status)}</td>
                              <td className="px-4 py-2 opacity-60"><div className="flex items-center justify-center gap-1"><CornerDownRight className="w-3 h-3" />{renderRequestTypeBadge(h.request_type)}</div></td>
                              <td className="px-4 py-2 opacity-60">{renderLeaveTypeBadge(h.leave_type)}</td>
                              <td className="px-4 py-2 opacity-60">{h.start_date} ~ {h.end_date}</td>
                              <td className="px-4 py-2 text-right opacity-60">-{Number(h.total_leave_days).toFixed(2)}일</td>
                              <td className="px-4 py-2 opacity-60">{renderApprovers(h.approval_lines)}</td>
                              <td className="px-4 py-2 truncate opacity-60">{h.reason || '-'}</td>
                              <td className="px-4 py-2 opacity-60">-</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full table-fixed text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <tr>
                      <th className="px-4 py-3 text-center w-[80px]">상태</th>
                      <th className="px-4 py-3 text-center w-[80px]">신청유형</th>
                      <th className="px-4 py-3 w-[240px]">근무 일자</th>
                      <th className="px-4 py-3 text-right w-[90px]">총 근무시간</th>
                      <th className="px-4 py-3 text-center w-[80px]">공휴일</th>
                      <th className="px-4 py-3 text-right w-[90px]">발생일수</th>
                      <th className="px-4 py-3 text-right w-[90px]">사용일수</th>
                      <th className="px-4 py-3 text-right w-[120px]">잔여일(시간)</th>
                      <th className="px-4 py-3 w-[120px]">결재자</th>
                      <th className="px-4 py-3">제목 / 사유</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedOvertimes.length === 0 ? <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">데이터가 없습니다.</td></tr> : groupedOvertimes.map((group: any[], i: number) => {
                      const latest = group[0], history = group.slice(1);
                      const rec = Number(latest.recognized_hours || 0), used = Number(latest.used_hours || 0), rem = rec - used;
                      return (
                        <React.Fragment key={i}>
                          <tr className="hover:bg-orange-50/30 cursor-pointer transition-colors" onClick={() => { setSelectedOvertime(latest); setIsOvertimeModalOpen(true); }}>
                            <td className="px-4 py-3.5 text-center">{renderStatusBadge(latest.status)}</td>
                            <td className="px-4 py-3.5 text-center">{renderRequestTypeBadge(latest.request_type)}</td>
                            <td className="px-4 py-3.5 font-bold">{latest.work_date} <span className="text-gray-500 font-normal ml-1">({latest.start_time.slice(0,5)}~{latest.end_time.slice(0,5)})</span></td>
                            <td className="px-4 py-3.5 text-right font-medium text-gray-900">{Number(latest.total_hours).toFixed(1)}h</td>
                            <td className="px-4 py-3.5 text-center">{renderHolidayBadge(latest.is_holiday)}</td>
                            <td className={`px-4 py-3.5 text-right font-bold ${latest.request_type === 'cancel' ? 'text-gray-300 line-through' : 'text-blue-600'}`}>+{(rec / 8).toFixed(2)}일</td>
                            <td className="px-4 py-3.5 text-right">{used > 0 ? <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded text-xs">-{(used / 8).toFixed(2)}일</span> : <span className="text-gray-300">-</span>}</td>
                            <td className="px-4 py-3.5 text-right">{latest.request_type === 'cancel' ? <span className="text-gray-300">-</span> : <div className="flex flex-col items-end"><span className="font-bold">{(rem / 8).toFixed(2)}일</span><span className="text-[11px] text-gray-500 font-medium">({rem}h)</span></div>}</td>
                            <td className="px-4 py-3.5">{renderApprovers(latest.approval_lines)}</td>
                            <td className="px-4 py-3.5">
                              <div className="font-medium truncate">{latest.title}</div>
                              <div className="text-xs text-gray-500 truncate mt-0.5">{latest.reason}</div>
                            </td>
                          </tr>
                          {history.map((h: any) => (
                            <tr key={h.id} className="bg-gray-50/50 text-gray-400 text-xs hover:bg-gray-100/50 cursor-pointer transition-colors" onClick={() => { setSelectedOvertime(h); setIsOvertimeModalOpen(true); }}>
                              <td className="px-4 py-2 text-center opacity-60">{renderStatusBadge(h.status)}</td>
                              <td className="px-4 py-2 opacity-60"><div className="flex items-center justify-center gap-1"><CornerDownRight className="w-3 h-3" />{renderRequestTypeBadge(h.request_type)}</div></td>
                              <td className="px-4 py-2 opacity-60">{h.work_date}</td>
                              <td className="px-4 py-2 text-right opacity-60">{Number(h.total_hours).toFixed(1)}h</td>
                              <td className="px-4 py-2 text-center opacity-60">{renderHolidayBadge(h.is_holiday)}</td>
                              <td className="px-4 py-2 text-right opacity-60">+{Number(Number(h.recognized_hours) / 8).toFixed(2)}일</td>
                              <td className="px-4 py-2 text-right opacity-60">-</td>
                              <td className="px-4 py-2 text-right opacity-60">-</td>
                              <td className="px-4 py-2 opacity-60">{renderApprovers(h.approval_lines)}</td>
                              <td className="px-4 py-2 truncate opacity-60"><span className="text-gray-600">{h.title}</span><span className="text-gray-400 ml-1">/ {h.reason}</span></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* 📱 모바일 뷰 */}
            <div className="block md:hidden divide-y divide-gray-100">
              {activeTab === 'leave' ? (
                groupedLeaves.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">데이터가 없습니다.</div> : groupedLeaves.map((group: any[], i: number) => {
                  const latest = group[0], history = group.slice(1);
                  const sourceOts = Array.isArray(latest.overtime_request_ids) ? latest.overtime_request_ids.map((id: string) => overtimes.find((ot: any) => ot.id === id)).filter(Boolean) : [];
                  return (
                    <div key={i} className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer" onClick={() => { setSelectedLeave(latest); setIsLeaveModalOpen(true); }}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">{renderRequestTypeBadge(latest.request_type)}{renderLeaveTypeBadge(latest.leave_type)}<span className="font-bold text-sm text-gray-900 bg-white">{latest.start_date} ~ {latest.end_date}</span></div>
                        <div className="shrink-0 ml-2">{renderStatusBadge(latest.status)}</div>
                      </div>
                      <div className="text-sm text-gray-600 line-clamp-2 mb-2">{latest.reason || '사유 없음'}</div>
                      <div className="bg-gray-50 rounded p-2 mb-3 border border-gray-100">{renderApprovers(latest.approval_lines)}</div>
                      <div className="flex justify-between items-end">
                        <div className="flex-1 overflow-hidden">
                          {sourceOts.length > 0 && (
                            <div className="flex flex-col gap-1.5 items-start">
                              {sourceOts.map((ot: any, idx: number) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-bold max-w-full" onClick={(e) => { e.stopPropagation(); setSelectedOvertime(ot); setIsOvertimeModalOpen(true); }}>
                                  <Link2 className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{ot.title}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className={`font-bold text-base shrink-0 ml-2 ${latest.request_type === 'cancel' ? 'text-gray-300 line-through' : 'text-gray-900'}`}>-{Number(latest.total_leave_days).toFixed(2)}일</div>
                      </div>
                      {history.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-dashed border-gray-100 space-y-1.5">
                          {history.map((h: any) => (
                            <div key={h.id} className="flex justify-between items-center text-xs text-gray-400" onClick={(e) => { e.stopPropagation(); setSelectedLeave(h); setIsLeaveModalOpen(true); }}>
                              <div className="flex items-center gap-1"><CornerDownRight className="w-3 h-3" />{renderRequestTypeBadge(h.request_type)}<span>{h.start_date} ~ {h.end_date}</span></div>
                              <div>-{Number(h.total_leave_days).toFixed(2)}일</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                groupedOvertimes.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">데이터가 없습니다.</div> : groupedOvertimes.map((group: any[], i: number) => {
                  const latest = group[0], history = group.slice(1);
                  const rec = Number(latest.recognized_hours || 0), used = Number(latest.used_hours || 0), rem = rec - used;
                  return (
                    <div key={i} className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer" onClick={() => { setSelectedOvertime(latest); setIsOvertimeModalOpen(true); }}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {renderRequestTypeBadge(latest.request_type)}
                          {renderHolidayBadge(latest.is_holiday)}
                          <span className="font-bold text-sm text-gray-900 bg-white">{latest.work_date}</span>
                          <span className="text-xs text-gray-500">({latest.start_time.slice(0,5)}~{latest.end_time.slice(0,5)}, {Number(latest.total_hours).toFixed(1)}h)</span>
                        </div>
                        <div className="shrink-0 ml-2">{renderStatusBadge(latest.status)}</div>
                      </div>
                      <div className="mb-2"><div className="text-sm font-medium line-clamp-1 text-gray-900 bg-white">{latest.title}</div><div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{latest.reason}</div></div>
                      <div className="bg-gray-50 rounded p-2 mb-3 border border-gray-100">{renderApprovers(latest.approval_lines)}</div>
                      <div className="flex justify-between items-end">
                        <div className="flex-1 flex flex-wrap gap-1.5">
                          {used > 0 && <span className="text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded text-[10px]">사용 -{(used / 8).toFixed(2)}일</span>}
                          {latest.request_type !== 'cancel' && <span className="text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px]">잔여 {(rem / 8).toFixed(2)}일 ({rem}h)</span>}
                        </div>
                        <div className={`font-bold text-base shrink-0 ml-2 ${latest.request_type === 'cancel' ? 'text-gray-300 line-through' : 'text-blue-600'}`}>+{(rec / 8).toFixed(2)}일</div>
                      </div>
                      {history.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-dashed border-gray-100 space-y-1.5">
                          {history.map((h: any) => (
                            <div key={h.id} className="flex justify-between items-center text-xs text-gray-400" onClick={(e) => { e.stopPropagation(); setSelectedOvertime(h); setIsOvertimeModalOpen(true); }}>
                              <div className="flex items-center gap-1">
                                <CornerDownRight className="w-3 h-3" />
                                {renderRequestTypeBadge(h.request_type)}
                                {renderHolidayBadge(h.is_holiday)}
                                <span className="truncate max-w-[180px]">{h.title} <span className="opacity-70">/ {h.reason}</span> ({Number(h.total_hours).toFixed(1)}h)</span>
                              </div>
                              <div>+{Number(Number(h.recognized_hours) / 8).toFixed(2)}일</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {selectedLeave && (
        <LeaveApplicationModal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} initialData={selectedLeave} />
      )}
      {selectedOvertime && (
        <OvertimeApplicationModal isOpen={isOvertimeModalOpen} onClose={() => setIsOvertimeModalOpen(false)} initialData={selectedOvertime} />
      )}
    </>
  );
}
