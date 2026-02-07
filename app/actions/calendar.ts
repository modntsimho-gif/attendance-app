"use server";

import { createClient } from "@/utils/supabase/server";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns";

export async function getCalendarEvents(
  userId: string | undefined, 
  currentDate: Date | string // Date 객체 또는 문자열 허용
) {
  const supabase = await createClient();
  let targetId = userId;

  // 1. userId가 없으면(내 달력) 현재 로그인한 유저 ID 가져오기
  if (!targetId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { leaves: [], overtimes: [], holidays: [] };
    targetId = user.id;
  }

  // 2. 조회할 날짜 범위 계산 (YYYY-MM-DD)
  // 달력 UI상 '이전 달의 마지막 주'와 '다음 달의 첫 주'도 표시되므로
  // 단순히 월초~월말이 아니라, 화면에 보이는 전체 날짜 범위를 커버해야 합니다.
  const current = typeof currentDate === 'string' ? new Date(currentDate) : currentDate;
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(monthStart);

  const startDateStr = format(startOfWeek(monthStart), "yyyy-MM-dd");
  const endDateStr = format(endOfWeek(monthEnd), "yyyy-MM-dd");

  // 3. 연차 내역 가져오기 (기간이 겹치는 것 조회)
  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, status")
    .eq("user_id", targetId)
    .neq("status", "rejected") // 거절된 건 제외
    .lte("start_date", endDateStr)
    .gte("end_date", startDateStr);

  // 4. 초과근무(보상휴가 발생) 내역 가져오기
  const { data: overtimes } = await supabase
    .from("overtime_requests")
    .select("id, title, work_date, total_hours, status")
    .eq("user_id", targetId)
    .neq("status", "rejected")
    .gte("work_date", startDateStr)
    .lte("work_date", endDateStr);

  // 5. [NEW] 공휴일 데이터 가져오기 (DB 테이블: public_holidays)
  // user_id와 상관없이 날짜 범위에 맞는 공휴일을 모두 가져옵니다.
  const { data: holidays } = await supabase
    .from("public_holidays")
    .select("id, date, title")
    .gte("date", startDateStr)
    .lte("date", endDateStr);

  return {
    leaves: leaves || [],
    overtimes: overtimes || [],
    holidays: holidays || [] // 프론트엔드로 반환
  };
}
