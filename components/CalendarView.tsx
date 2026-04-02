"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, 
  isSameMonth, isToday, isSameDay, isSaturday, isSunday, isWithinInterval, parseISO 
} from "date-fns";
import { 
  UserCircle, Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Building2 
} from "lucide-react";
import { getCalendarEvents } from "@/app/actions/calendar"; 

interface CalendarViewProps {
  targetUser?: { 
    id: string; 
    name: string; 
    department?: string;
    role?: string;
    position?: string;
    avatar_url?: string;
  } | null;
} 

// ⭐️ [수정] 부서 및 이름 필드를 옵션으로 추가
type LeaveEvent = {
  id: string;
  user_name?: string;
  department?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  color?: string;
};

type OvertimeEvent = {
  id: string;
  user_name?: string;
  department?: string;
  title: string;
  work_date: string;
  total_hours: number;
  status: string;
};

type HolidayEvent = {
  id: number;
  date: string;
  title: string;
};

export default function CalendarView({ targetUser }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [leaves, setLeaves] = useState<LeaveEvent[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeEvent[]>([]);
  const [holidays, setHolidays] = useState<HolidayEvent[]>([]); 
  
  const [loading, setLoading] = useState(false);

  // ⭐️ [추가] 부서 필터 상태
  const [selectedDept, setSelectedDept] = useState<string>("전체");

  const isMyCalendar = !targetUser;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getCalendarEvents(targetUser?.id, currentDate);
        setLeaves(data.leaves || []);
        setOvertimes(data.overtimes || []);
        setHolidays(data.holidays || []); 
      } catch (error) {
        console.error("일정 불러오기 실패:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentDate, targetUser]);

  // ⭐️ [추가] 존재하는 부서 목록 추출
  const availableDepts = useMemo(() => {
    const depts = new Set<string>();
    leaves.forEach(l => l.department && depts.add(l.department));
    overtimes.forEach(o => o.department && depts.add(o.department));
    
    // 부서가 없으면 필터를 보여줄 필요가 없으므로 빈 배열 반환
    if (depts.size === 0) return [];
    
    return ["전체", ...Array.from(depts).sort()];
  }, [leaves, overtimes]);

  // ⭐️ [추가] 선택된 부서에 맞게 일정 필터링
  const filteredLeaves = useMemo(() => {
    if (selectedDept === "전체") return leaves;
    return leaves.filter(l => l.department === selectedDept);
  }, [leaves, selectedDept]);

  const filteredOvertimes = useMemo(() => {
    if (selectedDept === "전체") return overtimes;
    return overtimes.filter(o => o.department === selectedDept);
  }, [overtimes, selectedDept]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="flex flex-col w-full bg-white rounded-xl shadow-lg border-t-4 border-t-blue-600 border-x border-b border-gray-200 overflow-hidden relative min-h-[1200px]">
      
      {loading && (
        <div className="absolute inset-0 bg-white/60 z-30 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-white p-4 rounded-full shadow-xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </div>
      )}

      {/* 특정 사용자 캘린더 조회 시 헤더 */}
      {!isMyCalendar && targetUser && (
        <div className="bg-gray-900 text-white px-6 py-3 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gray-700 rounded-full">
              <UserCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <span className="font-bold text-lg">{targetUser.name}</span>
              <span className="text-gray-400 text-sm ml-2">님의 일정을 보고 있습니다</span>
            </div>
          </div>
          <span className="text-xs font-bold bg-gray-700 px-3 py-1 rounded-full border border-gray-600">
            READ ONLY
          </span>
        </div>
      )}

      {/* 달력 컨트롤 영역 */}
      <div className="flex flex-col border-b border-gray-100 bg-white">
        <div className="flex justify-between items-center p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">
              {format(currentDate, "yyyy년 M월")}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              href="/calendar" 
              className="px-4 h-10 flex items-center justify-center bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 transition-all shadow-sm"
            >
              사용자 색상설정
            </Link>

            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                className="w-9 h-9 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-4 h-9 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-md transition-all text-sm font-bold text-gray-700"
              >
                오늘
              </button>
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                className="w-9 h-9 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ⭐️ [NEW] 부서별 필터 (Pill 탭) */}
        {availableDepts.length > 1 && (
          <div className="px-6 pb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <Building2 className="w-4 h-4 text-gray-400 mr-1" />
            {availableDepts.map(dept => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                  selectedDept === dept 
                    ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-200" 
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center bg-gray-50 border-b border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
          <div key={day} className={`py-3 text-sm font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px flex-1">
        {calendarDays.map((day: Date, idx: number) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const today = isToday(day);
          
          const holiday = holidays.find(h => h.date === format(day, "yyyy-MM-dd"));
          const isHoliday = !!holiday;

          const isRedDay = isSunday(day) || isHoliday;
          const isBlueDay = isSaturday(day) && !isHoliday; 

          // ⭐️ [수정] 필터링된 일정(filteredLeaves, filteredOvertimes) 사용
          const dayLeaves = filteredLeaves.filter(leave => 
            isWithinInterval(day, {
              start: parseISO(leave.start_date),
              end: parseISO(leave.end_date)
            })
          );
          const dayOvertimes = filteredOvertimes.filter(ot => 
            isSameDay(parseISO(ot.work_date), day)
          );

          return (
            <div
              key={idx}
              className={`
                min-h-[140px] p-2 flex flex-col items-start relative group transition-all
                ${!isCurrentMonth ? 'bg-gray-50/50 text-gray-300' : 'bg-white'}
                ${(isRedDay || isBlueDay) && isCurrentMonth ? 'bg-gray-50/30' : ''}
                ${today ? 'bg-blue-50/30 ring-2 ring-inset ring-blue-500 z-10' : 'hover:bg-gray-50'}
              `}
            >
              <div className="w-full flex justify-between items-start mb-1">
                <span className={`
                  text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full
                  ${!isCurrentMonth ? 'text-gray-300' : ''}
                  ${isRedDay && isCurrentMonth ? 'text-red-500' : ''}
                  ${isBlueDay && isCurrentMonth ? 'text-blue-500' : ''}
                  ${!isRedDay && !isBlueDay && isCurrentMonth ? 'text-gray-700' : ''}
                  ${today ? 'bg-blue-600 text-white shadow-md scale-110 !text-white' : ''}
                `}>
                  {format(day, 'd')}
                </span>

                {holiday && isCurrentMonth && (
                  <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 truncate max-w-[60px]">
                    {holiday.title}
                  </span>
                )}
              </div>

              <div className="w-full space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar mt-1">
                
                {/* 연차 렌더링 */}
                {dayLeaves.map((leave) => (
                  <div 
                    key={leave.id}
                    style={{ 
                      backgroundColor: leave.color ? `${leave.color}33` : undefined, 
                      color: leave.color ? '#1F2937' : undefined, 
                      borderColor: leave.color ? leave.color : undefined
                    }}
                    className={`
                      px-2 py-1 rounded-md text-xs font-bold shadow-sm border truncate flex items-center gap-1
                      ${!leave.color && leave.status === 'approved' ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}
                      ${!leave.color && leave.status !== 'approved' ? 'bg-orange-50 text-orange-600 border-orange-200 border-dashed' : ''}
                      ${!isMyCalendar ? 'opacity-90 grayscale-[0.3]' : ''}
                    `}
                  >
                    {leave.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
                    {/* ⭐️ [수정] 이름이 있으면 이름도 함께 표시 */}
                    {leave.user_name ? `${leave.user_name} ` : ''}{leave.leave_type}
                  </div>
                ))}

                {/* 초과근무 렌더링 */}
                {dayOvertimes.map((ot) => (
                  <div 
                    key={ot.id}
                    className={`
                      px-2 py-1 rounded-md text-xs font-bold shadow-sm border truncate flex items-center gap-1
                      bg-purple-100 text-purple-700 border-purple-200
                      ${!isMyCalendar ? 'opacity-90 grayscale-[0.3]' : ''}
                    `}
                  >
                    {/* ⭐️ [수정] 이름이 있으면 이름도 함께 표시 */}
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
