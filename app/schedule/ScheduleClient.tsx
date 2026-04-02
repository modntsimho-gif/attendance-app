"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { ArrowLeft, Users, Calendar, PieChart, Search, Building2 } from "lucide-react";

interface ScheduleClientProps {
  employees: any[];
  allocations: any[];
  leaves: any[];
  overtimes: any[];
}

export default function ScheduleClient({ 
  employees, 
  allocations, 
  leaves, 
  overtimes 
}: ScheduleClientProps) {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  
  // [State] 선택된 연도 및 검색어
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [searchTerm, setSearchTerm] = useState("");

  // ⭐️ [State] 정렬 기준 데이터
  const [dSorts, setDSorts] = useState<Record<string, number>>({});
  const [eSorts, setESorts] = useState<Record<string, number>>({});

  // ⭐️ DB에서 정렬 기준(sort_settings) 불러오기
  useEffect(() => {
    const fetchSortSettings = async () => {
      const { data } = await supabase.from('sort_settings').select('*');
      if (data) {
        const ds: Record<string, number> = {};
        const es: Record<string, number> = {};
        data.forEach((s: any) => {
          if (s.target_type === 'department') ds[s.target_id] = s.sort_order;
          if (s.target_type === 'employee') es[s.target_id] = s.sort_order;
        });
        setDSorts(ds);
        setESorts(es);
      }
    };
    fetchSortSettings();
  }, [supabase]);

  // [Logic] 연도별 데이터 계산
  const tableData = useMemo(() => {
    const yearStr = selectedYear.toString();

    return employees.map((emp) => {
      // --- 1. 기본 연차 계산 ---
      const alloc = allocations.find(a => a.user_id === emp.id && a.year === selectedYear);
      let totalAnnual = 0;
      if (alloc) {
        totalAnnual = alloc.total_days;
      } else if (selectedYear === currentYear) {
        totalAnnual = emp.total_leave_days || 0;
      }
      
      let usedAnnual = leaves
        .filter(l => 
          l.user_id === emp.id && 
          l.status === 'approved' && 
          l.request_type !== 'cancel' && 
          (
            l.leave_type === '연차' || 
            l.leave_type === 'annual' || 
            l.leave_type === '반차' || 
            l.leave_type === '반반차'
          ) && 
          l.start_date?.startsWith(yearStr)
        )
        .reduce((sum, l) => sum + Number(l.total_leave_days), 0);

      if (selectedYear === currentYear) {
        const profileUsed = Number(emp.used_leave_days || 0);
        if (profileUsed > usedAnnual) {
          usedAnnual = profileUsed;
        }
      }

      // --- 2. 보상 휴가 계산 ---
      const generatedOvertimeHours = overtimes
        .filter(o => 
          o.user_id === emp.id && 
          o.status === 'approved' && 
          o.request_type !== 'cancel' && 
          o.work_date?.startsWith(yearStr)
        )
        .reduce((sum, o) => sum + Number(o.recognized_hours || 0), 0);
      
      const totalExtra = generatedOvertimeHours / 8; 

      const usedExtra = overtimes
        .filter(o => 
          o.user_id === emp.id && 
          o.status === 'approved' && 
          o.request_type !== 'cancel' && 
          o.work_date?.startsWith(yearStr)
        )
        .reduce((sum, o) => sum + Number(o.used_hours || 0), 0) / 8;

      return {
        ...emp,
        department: emp.department || '소속 없음', // 부서가 없는 경우 기본값
        stats: {
          annual: {
            total: totalAnnual,
            used: usedAnnual,
            remaining: totalAnnual - usedAnnual,
            rate: totalAnnual > 0 ? (usedAnnual / totalAnnual) * 100 : 0
          },
          extra: {
            total: totalExtra,
            used: usedExtra,
            remaining: totalExtra - usedExtra,
            rate: totalExtra > 0 ? (usedExtra / totalExtra) * 100 : 0
          }
        }
      };
    });
  }, [employees, allocations, leaves, overtimes, selectedYear, currentYear]);

  // ⭐️ [Logic] 부서별 그룹화 및 정렬 적용
  const groupedData = useMemo(() => {
    // 1. 검색어 필터링
    const filtered = searchTerm.trim() 
      ? tableData.filter(emp => 
          emp.name.includes(searchTerm) || emp.department.includes(searchTerm)
        )
      : tableData;

    // 2. 부서별로 그룹화 및 정렬
    const uniqueDepts = Array.from(new Set(filtered.map(emp => emp.department)));
    const sortedDepts = uniqueDepts.sort((a, b) => (dSorts[a] ?? 99) - (dSorts[b] ?? 99));

    return sortedDepts.map(dept => {
      const emps = filtered.filter(emp => emp.department === dept);
      // 부서 내 직원 정렬
      emps.sort((a, b) => (eSorts[a.id] ?? 99) - (eSorts[b.id] ?? 99));
      return { dept, employees: emps };
    });
  }, [tableData, searchTerm, dSorts, eSorts]);

  // 사용 가능한 연도 목록 추출
  const availableYears = Array.from(new Set([
    currentYear,
    ...allocations.map(a => a.year),
    ...leaves.map(l => parseInt(l.start_date.split('-')[0]))
  ])).sort((a, b) => b - a);

  // 숫자 포맷팅 헬퍼
  const fmt = (num: number) => Number(num.toFixed(2)).toString();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-2 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> 대시보드로 돌아가기
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              전체 직원 근태 현황
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              모든 일반 직원(Employee)의 연차 및 보상 휴가 사용 내역을 조회합니다.
            </p>
          </div>

          {/* 검색 및 연도 선택기 영역 */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="이름 또는 부서 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm transition-shadow"
              />
            </div>

            <div className="relative w-full sm:w-auto">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full sm:w-auto appearance-none bg-white border border-gray-300 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}년 조회</option>
                ))}
              </select>
              <Calendar className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ⭐️ 부서별 리스트 렌더링 영역 */}
        <div className="space-y-8">
          {groupedData.length > 0 ? (
            groupedData.map((group) => (
              <div key={group.dept} className="space-y-3 animate-in fade-in duration-300">
                
                {/* 🏢 부서 헤더 */}
                <div className="flex items-center gap-2 px-1">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-gray-800">{group.dept}</h2>
                  <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2.5 py-0.5 rounded-full ml-1">
                    {group.employees.length}명
                  </span>
                </div>

                {/* 🖥️ [PC 뷰] 부서별 테이블 */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 font-bold min-w-[150px] sticky left-0 bg-gray-50 z-10">직원 정보</th>
                        <th colSpan={4} className="px-6 py-4 text-center border-l border-gray-200 bg-blue-50/50 text-blue-800">
                          <div className="flex items-center justify-center gap-1">
                            <Calendar className="w-4 h-4" /> {selectedYear}년 기본 연차
                          </div>
                        </th>
                        <th colSpan={4} className="px-6 py-4 text-center border-l border-gray-200 bg-orange-50/50 text-orange-800">
                          <div className="flex items-center justify-center gap-1">
                            <PieChart className="w-4 h-4" /> {selectedYear}년 연차 외 휴가 (보상)
                          </div>
                        </th>
                      </tr>
                      <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-3 sticky left-0 bg-gray-50 z-10">이름 / 직급</th>
                        <th className="px-4 py-3 text-right border-l border-gray-100 bg-blue-50/30">총 연차</th>
                        <th className="px-4 py-3 text-right bg-blue-50/30">사용</th>
                        <th className="px-4 py-3 text-right bg-blue-50/30 font-bold text-gray-700">잔여</th>
                        <th className="px-4 py-3 text-center bg-blue-50/30">사용률</th>
                        <th className="px-4 py-3 text-right border-l border-gray-100 bg-orange-50/30">총 발생</th>
                        <th className="px-4 py-3 text-right bg-orange-50/30">사용</th>
                        <th className="px-4 py-3 text-right bg-orange-50/30 font-bold text-gray-700">잔여</th>
                        <th className="px-4 py-3 text-center bg-orange-50/30">사용률</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-gray-100">
                      {group.employees.map((emp) => {
                        const annual = emp.stats.annual;
                        const extra = emp.stats.extra;

                        return (
                          <tr key={emp.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-gray-50 transition-colors border-r border-transparent group-hover:border-gray-200">
                                <Link href={`/schedule/${emp.id}`} className="flex items-center gap-3 group-hover:opacity-80">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                    {emp.name.slice(0, 1)}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900 underline decoration-indigo-200 underline-offset-2 group-hover:text-indigo-600">
                                    {emp.name}
                                    </div>
                                    <div className="text-xs text-gray-500">{emp.position || "직급없음"}</div>
                                </div>
                                </Link>
                            </td>
                            <td className="px-4 py-4 text-right border-l border-gray-100 text-gray-600">{fmt(annual.total)}</td>
                            <td className="px-4 py-4 text-right text-blue-600 font-medium">{fmt(annual.used)}</td>
                            <td className={`px-4 py-4 text-right font-bold ${annual.remaining < 0 ? 'text-red-500' : 'text-gray-800'}`}>{fmt(annual.remaining)}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${annual.rate > 80 ? 'bg-red-400' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, annual.rate)}%` }}></div>
                                </div>
                                <span className="text-xs text-gray-500 w-8 text-right">{fmt(annual.rate)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right border-l border-gray-100 text-gray-600">{fmt(extra.total)}</td>
                            <td className="px-4 py-4 text-right text-orange-600 font-medium">{fmt(extra.used)}</td>
                            <td className={`px-4 py-4 text-right font-bold ${extra.remaining < 0 ? 'text-red-500' : 'text-gray-800'}`}>{fmt(extra.remaining)}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(100, extra.rate)}%` }}></div>
                                </div>
                                <span className="text-xs text-gray-500 w-8 text-right">{fmt(extra.rate)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 📱 [모바일 뷰] 부서별 카드 리스트 */}
                <div className="block md:hidden bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                  {group.employees.map((emp) => {
                    const annual = emp.stats.annual;
                    const extra = emp.stats.extra;

                    return (
                      <div key={emp.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col gap-4">
                        <Link href={`/schedule/${emp.id}`} className="flex items-center gap-3 w-fit">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                            {emp.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-base underline decoration-indigo-200 underline-offset-2">
                              {emp.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {emp.position || "직급없음"}
                            </div>
                          </div>
                        </Link>

                        <div className="grid grid-cols-1 gap-3">
                          {/* 기본 연차 박스 */}
                          <div className="bg-blue-50/30 rounded-lg p-3 border border-blue-100/50">
                            <div className="flex items-center gap-1.5 text-blue-800 font-bold text-sm mb-3">
                              <Calendar className="w-4 h-4" /> 기본 연차
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center mb-3">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">총 연차</div>
                                <div className="font-medium text-gray-700">{fmt(annual.total)}</div>
                              </div>
                              <div className="border-l border-blue-100/50">
                                <div className="text-xs text-gray-500 mb-1">사용</div>
                                <div className="font-bold text-blue-600">{fmt(annual.used)}</div>
                              </div>
                              <div className="border-l border-blue-100/50">
                                <div className="text-xs text-gray-500 mb-1">잔여</div>
                                <div className={`font-bold ${annual.remaining < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                                  {fmt(annual.remaining)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${annual.rate > 80 ? 'bg-red-400' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, annual.rate)}%` }}></div>
                              </div>
                              <span className="text-xs text-gray-500 font-medium w-10 text-right">{fmt(annual.rate)}%</span>
                            </div>
                          </div>

                          {/* 보상 휴가 박스 */}
                          <div className="bg-orange-50/30 rounded-lg p-3 border border-orange-100/50">
                            <div className="flex items-center gap-1.5 text-orange-800 font-bold text-sm mb-3">
                              <PieChart className="w-4 h-4" /> 연차 외 휴가 (보상)
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center mb-3">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">총 발생</div>
                                <div className="font-medium text-gray-700">{fmt(extra.total)}</div>
                              </div>
                              <div className="border-l border-orange-100/50">
                                <div className="text-xs text-gray-500 mb-1">사용</div>
                                <div className="font-bold text-orange-600">{fmt(extra.used)}</div>
                              </div>
                              <div className="border-l border-orange-100/50">
                                <div className="text-xs text-gray-500 mb-1">잔여</div>
                                <div className={`font-bold ${extra.remaining < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                                  {fmt(extra.remaining)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(100, extra.rate)}%` }}></div>
                              </div>
                              <span className="text-xs text-gray-500 font-medium w-10 text-right">{fmt(extra.rate)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
              {searchTerm ? '검색 결과가 없습니다.' : '등록된 일반 직원(Employee)이 없습니다.'}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
