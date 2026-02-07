"use client";

import { useEffect, useState } from "react";
import { User, Home, Plane, CalendarHeart, Loader2, Palmtree, Briefcase } from "lucide-react";
import { getDashboardData } from "@/app/actions/dashboard";
import { format, parseISO, differenceInCalendarDays } from "date-fns";

export default function DashboardWidgets() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    todayLeaves: any[];
    myNextLeave: any;
    upcomingEvents: any[];
  }>({ todayLeaves: [], myNextLeave: null, upcomingEvents: [] });

  useEffect(() => {
    async function fetchData() {
      const res = await getDashboardData();
      
      // 공휴일과 직원 휴가를 합쳐서 날짜순 정렬
      const mergedEvents = [
        ...res.holidays.map((h: any) => ({ ...h, type: 'holiday' })),
        ...res.upcomingLeaves.map((l: any) => ({ ...l, type: 'leave' }))
      ].sort((a, b) => {
        const dateA = a.date || a.start_date;
        const dateB = b.date || b.start_date;
        return dateA.localeCompare(dateB);
      }).slice(0, 10); // 데이터는 넉넉히 가져오되 스크롤로 보여줌

      setData({
        todayLeaves: res.todayLeaves,
        myNextLeave: res.myNextLeave,
        upcomingEvents: mergedEvents
      });
      setLoading(false);
    }
    fetchData();
  }, []);

  // 휴가 타입에 따른 스타일 및 아이콘 반환 함수
  const getLeaveStyle = (type: string) => {
    if (type.includes("재택")) {
      return { 
        bg: "bg-green-50", border: "border-green-100", 
        iconBg: "bg-green-200", iconText: "text-green-700", 
        text: "text-green-600", badge: "text-green-700",
        Icon: Home, label: "WFH" 
      };
    } else if (type.includes("외근") || type.includes("출장")) {
      return { 
        bg: "bg-blue-50", border: "border-blue-100", 
        iconBg: "bg-blue-200", iconText: "text-blue-700", 
        text: "text-blue-600", badge: "text-blue-700",
        Icon: Plane, label: "Trip" 
      };
    } else {
      // 기본 연차/반차 등
      return { 
        bg: "bg-red-50", border: "border-red-100", 
        iconBg: "bg-red-200", iconText: "text-red-700", 
        text: "text-red-500", badge: "text-red-600",
        Icon: Palmtree, label: "OFF" 
      };
    }
  };

  // D-Day 계산
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      
      {/* 위젯 1: 오늘의 휴가자 */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[340px]">
        <div className="flex justify-between items-start mb-4 shrink-0">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Palmtree className="w-5 h-5 text-green-600" />
            오늘의 휴가자
          </h3>
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
            {data.todayLeaves.length}명
          </span>
        </div>
        
        {/* min-h-0 추가: 내부 스크롤이 부모 높이를 넘지 않도록 제한 */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 min-h-0">
          {data.todayLeaves.length > 0 ? (
            data.todayLeaves.map((leave: any) => {
              const style = getLeaveStyle(leave.leave_type);
              const StyleIcon = style.Icon;
              return (
                <div key={leave.id} className={`flex items-center justify-between p-3 rounded-lg border ${style.bg} ${style.border}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${style.iconBg} flex items-center justify-center ${style.iconText} font-bold text-xs`}>
                      {leave.profiles.name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-800">
                        {leave.profiles.name} <span className="text-xs font-normal text-gray-500">{leave.profiles.position}</span>
                      </div>
                      <div className={`text-xs ${style.text} font-medium`}>
                        {leave.leave_type}
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
              <span className="text-sm">오늘 휴가자가 없습니다.</span>
            </div>
          )}
        </div>
      </div>

      {/* 위젯 2: 주요 일정 & D-Day */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[340px]">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 shrink-0">
          <CalendarHeart className="w-5 h-5 text-pink-500" />
          다가오는 주요 일정
        </h3>

        {/* min-h-0 추가: Flex 자식이 부모 높이를 뚫고 나가는 현상 방지 */}
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* D-Day 카드 (고정 높이) */}
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

          {/* 리스트 (남은 공간 차지 + 스크롤) */}
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar divide-y divide-gray-100">
            {data.upcomingEvents.length > 0 ? (
              data.upcomingEvents.map((event: any, idx: number) => {
                const dateStr = event.date || event.start_date;
                const isHoliday = event.type === 'holiday';
                const dDay = getDday(dateStr);

                return (
                  <div key={idx} className="py-3 flex items-center gap-3">
                    <div className="w-10 text-center shrink-0">
                      <div className="text-[10px] text-gray-400 font-bold uppercase">
                        {format(parseISO(dateStr), "MMM")}
                      </div>
                      <div className={`text-lg font-bold leading-none ${isHoliday ? 'text-red-500' : 'text-gray-800'}`}>
                        {format(parseISO(dateStr), "dd")}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold truncate ${isHoliday ? 'text-gray-700' : 'text-gray-800'}`}>
                        {event.title || `${event.profiles.name}님 ${event.leave_type}`}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {isHoliday ? "공휴일" : `${event.profiles.department} • ${event.leave_type}`}
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
  );
}
