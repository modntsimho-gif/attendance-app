"use client";

import { useEffect, useState, useMemo } from "react";
import { User, Home, Plane, CalendarHeart, Loader2, Palmtree, Briefcase } from "lucide-react";
import { getDashboardData } from "@/app/actions/dashboard";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { createClient } from "@/utils/supabase/client";

export default function DashboardWidgets() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    todayLeaves: any[];
    myNextLeave: any;
    upcomingEvents: any[];
  }>({ todayLeaves: [], myNextLeave: null, upcomingEvents: [] });

  // ⭐️ [State] 부서 필터 및 정렬 데이터
  const [selectedDept, setSelectedDept] = useState<string>("전체");
  const [dSorts, setDSorts] = useState<Record<string, number>>({});
  const [eSorts, setESorts] = useState<Record<string, number>>({});
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. 대시보드 데이터 호출
        const res = await getDashboardData();
        
        // 공휴일과 직원 휴가를 합쳐서 1차 날짜순 정렬
        const mergedEvents = [
          ...res.holidays.map((h: any) => ({ ...h, type: 'holiday', date: h.date })),
          ...res.upcomingLeaves.map((l: any) => ({ ...l, type: 'leave', date: l.start_date }))
        ].sort((a, b) => a.date.localeCompare(b.date));

        setData({
          todayLeaves: res.todayLeaves,
          myNextLeave: res.myNextLeave,
          upcomingEvents: mergedEvents
        });

        // 2. 정렬 설정(sort_settings) 호출
        const { data: sortData } = await supabase.from('sort_settings').select('*');
        if (sortData) {
          const ds: Record<string, number> = {};
          const es: Record<string, number> = {};
          sortData.forEach((s: any) => {
            if (s.target_type === 'department') ds[s.target_id] = s.sort_order;
            if (s.target_type === 'employee') es[s.target_id] = s.sort_order;
          });
          setDSorts(ds);
          setESorts(es);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [supabase]);

  // ⭐️ [Logic] 부서 필터링 및 2차 정렬 적용
  const { availableDepts, filteredTodayLeaves, filteredUpcomingEvents, activeDept } = useMemo(() => {
    // 1. 존재하는 부서 목록 추출 (공휴일 제외)
    const depts = new Set<string>();
    data.todayLeaves.forEach(l => depts.add(l.profiles?.department || "소속 없음"));
    data.upcomingEvents.forEach(e => {
      if (e.type === 'leave') depts.add(e.profiles?.department || "소속 없음");
    });

    const uniqueDepts = Array.from(depts);
    const sortedDepts = uniqueDepts.sort((a, b) => (dSorts[a] ?? 999) - (dSorts[b] ?? 999));
    const availableDepts = ["전체", ...sortedDepts];

    const activeDept = availableDepts.includes(selectedDept) ? selectedDept : "전체";

    // 2. 오늘의 휴가자 필터링 & 정렬
    let filteredToday = activeDept === "전체"
      ? data.todayLeaves
      : data.todayLeaves.filter(l => (l.profiles?.department || "소속 없음") === activeDept);

    filteredToday = [...filteredToday].sort((a, b) => {
      const deptA = a.profiles?.department || "소속 없음";
      const deptB = b.profiles?.department || "소속 없음";
      const dOrderA = dSorts[deptA] ?? 999;
      const dOrderB = dSorts[deptB] ?? 999;
      
      if (dOrderA !== dOrderB) return dOrderA - dOrderB;
      
      const eOrderA = eSorts[a.user_id] ?? 999;
      const eOrderB = eSorts[b.user_id] ?? 999;
      return eOrderA - eOrderB;
    });

    // 3. 다가오는 일정 필터링 & 정렬 (공휴일은 부서 상관없이 항상 표시)
    let filteredUpcoming = data.upcomingEvents.filter(e => {
      if (e.type === 'holiday') return true;
      if (activeDept === "전체") return true;
      return (e.profiles?.department || "소속 없음") === activeDept;
    });

    filteredUpcoming = [...filteredUpcoming].sort((a, b) => {
      // 1순위: 날짜순
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      
      // 2순위: 같은 날짜면 공휴일 우선
      if (a.type === 'holiday' && b.type !== 'holiday') return -1;
      if (a.type !== 'holiday' && b.type === 'holiday') return 1;
      if (a.type === 'holiday' && b.type === 'holiday') return 0;

      // 3순위: 부서 및 직원 정렬
      const deptA = a.profiles?.department || "소속 없음";
      const deptB = b.profiles?.department || "소속 없음";
      const dOrderA = dSorts[deptA] ?? 999;
      const dOrderB = dSorts[deptB] ?? 999;
      
      if (dOrderA !== dOrderB) return dOrderA - dOrderB;
      
      const eOrderA = eSorts[a.user_id] ?? 999;
      const eOrderB = eSorts[b.user_id] ?? 999;
      return eOrderA - eOrderB;
    });

    // UI에는 최대 10개까지만 표시
    return { 
      availableDepts, 
      filteredTodayLeaves: filteredToday, 
      filteredUpcomingEvents: filteredUpcoming.slice(0, 10), 
      activeDept 
    };
  }, [data, selectedDept, dSorts, eSorts]);

  // 휴가 타입 스타일
  const getLeaveStyle = (type: string) => {
    if (type.includes("재택")) return { bg: "bg-green-50", border: "border-green-100", iconBg: "bg-green-200", iconText: "text-green-700", text: "text-green-600", badge: "text-green-700", Icon: Home, label: "WFH" };
    if (type.includes("외근") || type.includes("출장")) return { bg: "bg-blue-50", border: "border-blue-100", iconBg: "bg-blue-200", iconText: "text-blue-700", text: "text-blue-600", badge: "text-blue-700", Icon: Plane, label: "Trip" };
    return { bg: "bg-red-50", border: "border-red-100", iconBg: "bg-red-200", iconText: "text-red-700", text: "text-red-500", badge: "text-red-600", Icon: Palmtree, label: "OFF" };
  };

  const getDday = (dateStr: string) => {
    const diff = differenceInCalendarDays(parseISO(dateStr), new Date());
    return diff === 0 ? "D-Day" : `D-${diff}`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 min-h-[300px]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center h-[340px]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center h-[340px]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      
      {/* ⭐️ 부서 필터 탭 (Pill) */}
      {availableDepts.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {availableDepts.map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                activeDept === dept 
                  ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-200" 
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. 오늘의 휴가자 */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[340px]">
          <div className="flex justify-between items-start mb-4 shrink-0">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Palmtree className="w-5 h-5 text-green-600" />
              오늘의 휴가자
            </h3>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
              {filteredTodayLeaves.length}명
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 min-h-0">
            {filteredTodayLeaves.length > 0 ? (
              filteredTodayLeaves.map((leave: any) => {
                const style = getLeaveStyle(leave.leave_type);
                const StyleIcon = style.Icon;
                return (
                  <div key={leave.id} className={`flex items-center justify-between p-3 rounded-lg border ${style.bg} ${style.border}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${style.iconBg} flex items-center justify-center ${style.iconText} font-bold text-xs`}>
                        {leave.profiles?.name?.[0] || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800">
                          {leave.profiles?.name} <span className="text-xs font-normal text-gray-500">{leave.profiles?.position}</span>
                        </div>
                        <div className={`text-xs ${style.text} font-medium`}>
                          {leave.profiles?.department || '소속 없음'} • {leave.leave_type}
                        </div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 text-xs bg-white px-2 py-1 rounded ${style.badge} font-bold shadow-sm`}>
                      <StyleIcon className="w-3 h-3" /> {style.label}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <Palmtree className="w-8 h-8 opacity-20" />
                <span className="text-sm">
                  {activeDept === "전체" ? "오늘 휴가자가 없습니다." : `${activeDept} 휴가자가 없습니다.`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. 주요 일정 & D-Day */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[340px]">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 shrink-0">
            <CalendarHeart className="w-5 h-5 text-pink-500" />
            다가오는 주요 일정
          </h3>

          <div className="flex-1 flex flex-col min-h-0">
            
            {/* D-Day 카드 */}
            <div className="mb-4 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-4 text-white shadow-md relative overflow-hidden group shrink-0">
              <div className="absolute right-0 top-0 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
                <Plane className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                {data.myNextLeave ? (
                  <>
                    <div className="text-xs font-medium text-purple-100 mb-1">내 다음 휴가 ({data.myNextLeave.leave_type})</div>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold">{getDday(data.myNextLeave.start_date)}</span>
                      <span className="text-sm text-purple-200 mb-1">
                        ({format(parseISO(data.myNextLeave.start_date), "M월 d일")})
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-medium text-purple-100 mb-1">예정된 휴가가 없습니다</div>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-bold">화이팅! 💪</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 리스트 */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar divide-y divide-gray-100">
              {filteredUpcomingEvents.length > 0 ? (
                filteredUpcomingEvents.map((event: any, idx: number) => {
                  const isHoliday = event.type === 'holiday';
                  const dDay = getDday(event.date);

                  return (
                    <div key={idx} className="py-3 flex items-center gap-3">
                      <div className="w-10 text-center shrink-0">
                        <div className="text-[10px] text-gray-400 font-bold uppercase">
                          {format(parseISO(event.date), "MMM")}
                        </div>
                        <div className={`text-lg font-bold leading-none ${isHoliday ? 'text-red-500' : 'text-gray-800'}`}>
                          {format(parseISO(event.date), "dd")}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold truncate ${isHoliday ? 'text-gray-700' : 'text-gray-800'}`}>
                          {event.title || `${event.profiles?.name}님 ${event.leave_type}`}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {isHoliday ? "공휴일" : `${event.profiles?.department || '소속 없음'} • ${event.leave_type}`}
                        </div>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${
                        isHoliday ? 'text-red-500 bg-red-50' : 'text-gray-500 bg-gray-100'
                      }`}>
                        {dDay}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  예정된 일정이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
