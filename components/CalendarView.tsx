"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay, isSaturday, isSunday, isWithinInterval, parseISO } from "date-fns";
import { UserCircle, Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Building2 } from "lucide-react";
import { getCalendarEvents } from "@/app/actions/calendar"; 

interface CalendarViewProps {
  targetUser?: { id: string; name: string; department?: string; role?: string; position?: string; avatar_url?: string; } | null;
} 

type BaseEvent = { id: string; user_name?: string; department?: string; status: string; };
type LeaveEvent = BaseEvent & { leave_type: string; start_date: string; end_date: string; color?: string; };
type OvertimeEvent = BaseEvent & { title: string; work_date: string; total_hours: number; };
type HolidayEvent = { id: number; date: string; title: string; };

export default function CalendarView({ targetUser }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  // 1. 3개의 상태를 하나의 events 객체로 통합
  const [events, setEvents] = useState({ leaves: [] as LeaveEvent[], overtimes: [] as OvertimeEvent[], holidays: [] as HolidayEvent[] });
  const [loading, setLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>("전체");

  const isMyCalendar = !targetUser;
  const { leaves, overtimes, holidays } = events;

  useEffect(() => {
    setLoading(true);
    getCalendarEvents(targetUser?.id, currentDate)
      .then(data => setEvents({ leaves: data.leaves || [], overtimes: data.overtimes || [], holidays: data.holidays || [] }))
      .catch(err => console.error("일정 불러오기 실패:", err))
      .finally(() => setLoading(false));
  }, [currentDate, targetUser]);

  // 2. Set과 체이닝을 활용한 부서 목록 추출 최적화
  const availableDepts = useMemo(() => {
    const depts = Array.from(
      new Set([...leaves, ...overtimes].map(e => e.department).filter((d): d is string => !!d))
    ).sort();
    
    return depts.length ? ["전체", ...depts] : [];
  }, [leaves, overtimes]);
  const filteredLeaves = selectedDept === "전체" ? leaves : leaves.filter(l => l.department === selectedDept);
  const filteredOvertimes = selectedDept === "전체" ? overtimes : overtimes.filter(o => o.department === selectedDept);

  // 3. 날짜 계산 로직 압축
  const monthStart = startOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) });

  // 4. 반복되는 공통 스타일 추출
  const btnBase = "w-9 h-9 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600";
  const badgeBase = `px-2 py-1 rounded-md text-xs font-bold shadow-sm border truncate flex items-center gap-1 ${!isMyCalendar ? 'opacity-90 grayscale-[0.3]' : ''}`;

  return (
    <div className="flex flex-col w-full bg-white rounded-xl shadow-lg border-t-4 border-t-blue-600 border-x border-b border-gray-200 overflow-hidden relative min-h-[1200px]">
      
      {loading && (
        <div className="absolute inset-0 bg-white/60 z-30 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-white p-4 rounded-full shadow-xl"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        </div>
      )}

      {/* 특정 사용자 캘린더 조회 시 헤더 */}
      {!isMyCalendar && targetUser && (
        <div className="bg-gray-900 text-white px-6 py-3 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gray-700 rounded-full"><UserCircle className="w-5 h-5 text-yellow-400" /></div>
            <div>
              <span className="font-bold text-lg">{targetUser.name}</span>
              <span className="text-gray-400 text-sm ml-2">님의 일정을 보고 있습니다</span>
            </div>
          </div>
          <span className="text-xs font-bold bg-gray-700 px-3 py-1 rounded-full border border-gray-600">READ ONLY</span>
        </div>
      )}

      {/* 달력 컨트롤 영역 */}
      <div className="flex flex-col border-b border-gray-100 bg-white">
        <div className="flex justify-between items-center p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><CalendarIcon className="w-6 h-6" /></div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">{format(currentDate, "yyyy년 M월")}</h2>
          </div>
          
          <div className="flex items-center gap-3">
            <Link href="/calendar" className="px-4 h-10 flex items-center justify-center bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 transition-all shadow-sm">
              사용자 색상설정
            </Link>
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className={btnBase}><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-4 h-9 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-md transition-all text-sm font-bold text-gray-700">오늘</button>
              <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className={btnBase}><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        {/* 부서별 필터 */}
        {availableDepts.length > 1 && (
          <div className="px-6 pb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <Building2 className="w-4 h-4 text-gray-400 mr-1" />
            {availableDepts.map(dept => (
              <button key={dept} onClick={() => setSelectedDept(dept)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedDept === dept ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-200" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
                {dept}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center bg-gray-50 border-b border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
          <div key={day} className={`py-3 text-sm font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{day}</div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px flex-1">
        {calendarDays.map((day, idx) => {
          const isCur = isSameMonth(day, monthStart);
          const isTod = isToday(day);
          const dateStr = format(day, "yyyy-MM-dd");
          const holiday = holidays.find(h => h.date === dateStr);
          const isRed = isSunday(day) || !!holiday;
          const isBlue = isSaturday(day) && !holiday; 

          const dayLeaves = filteredLeaves.filter(l => isWithinInterval(day, { start: parseISO(l.start_date), end: parseISO(l.end_date) }));
          const dayOvertimes = filteredOvertimes.filter(ot => isSameDay(parseISO(ot.work_date), day));

          return (
            <div key={idx} className={`min-h-[140px] p-2 flex flex-col items-start relative transition-all ${!isCur ? 'bg-gray-50/50' : 'bg-white'} ${(isRed || isBlue) && isCur ? 'bg-gray-50/30' : ''} ${isTod ? 'bg-blue-50/30 ring-2 ring-inset ring-blue-500 z-10' : 'hover:bg-gray-50'}`}>
              <div className="w-full flex justify-between items-start mb-1">
                <span className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full ${!isCur ? 'text-gray-300' : isRed ? 'text-red-500' : isBlue ? 'text-blue-500' : 'text-gray-700'} ${isTod ? 'bg-blue-600 !text-white shadow-md scale-110' : ''}`}>
                  {format(day, 'd')}
                </span>
                {holiday && isCur && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 truncate max-w-[60px]">{holiday.title}</span>}
              </div>

              <div className="w-full space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar mt-1">
                {/* 연차 렌더링 */}
                {dayLeaves.map(l => (
                  <div key={l.id} style={{ backgroundColor: l.color ? `${l.color}33` : undefined, color: l.color ? '#1F2937' : undefined, borderColor: l.color }} className={`${badgeBase} ${!l.color && l.status === 'approved' ? 'bg-blue-100 text-blue-700 border-blue-200' : ''} ${!l.color && l.status !== 'approved' ? 'bg-orange-50 text-orange-600 border-orange-200 border-dashed' : ''}`}>
                    {l.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
                    {l.user_name ? `${l.user_name} ` : ''}{l.leave_type}
                  </div>
                ))}

                {/* 초과근무 렌더링 */}
                {dayOvertimes.map(ot => (
                  <div key={ot.id} className={`${badgeBase} bg-purple-100 text-purple-700 border-purple-200`}>
                    {ot.user_name ? `${ot.user_name} ` : ''}{ot.title || "초과근무"} ({ot.total_hours}h)
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
