"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay, addDays, isSaturday, isSunday } from "date-fns";
import { UserCircle } from "lucide-react";

// 1. 내 데이터
const myLeaves = [
  { date: new Date(), type: "연차", status: "pending" },
  { date: addDays(new Date(), 3), type: "오전반차", status: "approved" },
  { date: addDays(new Date(), 15), type: "연차", status: "approved" },
];

// 2. 다른 사람 데이터 (가짜)
const otherLeavesMap: any = {
  kim: [ // 김토스
    { date: addDays(new Date(), 1), type: "병가", status: "approved" },
    { date: addDays(new Date(), 2), type: "병가", status: "approved" },
    { date: addDays(new Date(), 20), type: "연차", status: "pending" },
  ],
  lee: [ // 이디자
    { date: addDays(new Date(), -2), type: "여름휴가", status: "approved" },
    { date: addDays(new Date(), -1), type: "여름휴가", status: "approved" },
    { date: new Date(), type: "여름휴가", status: "approved" }, // 오늘 휴가 중
  ],
  park: [] // 박백엔 (휴가 없음)
};

// Props 추가
interface CalendarViewProps {
  targetUser?: { id: string; name: string; role: string } | null;
}

export default function CalendarView({ targetUser }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // targetUser가 바뀌면 보여줄 데이터 선택
  const currentLeaves = targetUser ? (otherLeavesMap[targetUser.id] || []) : myLeaves;
  const isMyCalendar = !targetUser;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getDateColor = (day: Date, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return "text-gray-300";
    if (isSunday(day)) return "text-red-500";
    if (isSaturday(day)) return "text-blue-500";
    return "text-gray-700";
  };

  return (
    <div className="flex flex-col w-full bg-white relative">
      
      {/* 타인 캘린더 조회 시 상단 배너 표시 */}
      {!isMyCalendar && (
        <div className="absolute -top-14 left-0 right-0 bg-gray-800 text-white px-4 py-2 rounded-lg flex justify-between items-center shadow-md z-20 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-yellow-400" />
            <span className="font-bold">{targetUser.name}</span>
            <span className="text-sm text-gray-300">님의 일정을 보고 있습니다.</span>
          </div>
          <div className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
            읽기 전용 모드
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4 px-1 mt-2">
        <h2 className={`text-xl font-bold ${isMyCalendar ? 'text-gray-900' : 'text-blue-700'}`}>
          {format(currentDate, "yyyy. MM")}
        </h2>
        <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-100">
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
            className="w-7 h-7 flex items-center justify-center hover:bg-white hover:shadow-sm rounded transition-all text-gray-500 text-xs"
          >
            ◀
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-3 h-7 flex items-center justify-center hover:bg-white hover:shadow-sm rounded transition-all text-xs font-bold text-gray-600 mx-0.5"
          >
            오늘
          </button>
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
            className="w-7 h-7 flex items-center justify-center hover:bg-white hover:shadow-sm rounded transition-all text-gray-500 text-xs"
          >
            ▶
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center mb-1 bg-gray-50/50 rounded-t-lg border-x border-t border-gray-200 py-1.5">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
          <div key={day} className={`text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className={`grid grid-cols-7 auto-rows-fr border-l border-t border-gray-200 rounded-b-lg overflow-hidden ${!isMyCalendar ? 'border-blue-100' : ''}`}>
        {calendarDays.map((day: Date, idx: number) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const dayLeaves = currentLeaves.filter((leave: any) => isSameDay(leave.date, day));

          return (
            <div
              key={idx}
              className={`
                min-h-[85px] p-1.5 border-b border-r border-gray-200 flex flex-col items-start justify-start relative transition-colors
                ${!isCurrentMonth ? 'bg-gray-50/30' : 'bg-white'}
                ${isToday(day) ? 'bg-blue-50/20' : ''}
                hover:bg-gray-50
              `}
            >
              {isToday(day) && (
                <span className="absolute top-1.5 left-1.5 w-6 h-6 bg-blue-600 rounded-full -z-0 opacity-10"></span>
              )}

              <span className={`
                text-sm font-semibold z-10 mb-1 px-1
                ${getDateColor(day, isCurrentMonth)}
                ${isToday(day) ? '!text-blue-700' : ''}
              `}>
                {format(day, 'd')}
              </span>

              <div className="w-full space-y-0.5 mt-0.5">
                {dayLeaves.map((leave: any, i: number) => (
                  <div 
                    key={i}
                    className={`
                      text-[10px] px-1.5 py-0.5 rounded w-full truncate font-medium border
                      ${leave.status === 'approved' 
                        ? 'bg-blue-50 text-blue-600 border-blue-100' 
                        : 'bg-orange-50 text-orange-600 border-orange-100 border-dashed'
                      }
                      ${!isMyCalendar ? '!bg-gray-100 !text-gray-600 !border-gray-200' : ''} 
                    `}
                  >
                    {/* 내 캘린더가 아니면 회색으로 표시 (읽기 전용 느낌) */}
                    {leave.status === 'pending' && isMyCalendar && '⏳ '}{leave.type}
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
