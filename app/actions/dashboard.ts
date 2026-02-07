"use server";

import { createClient } from "@/utils/supabase/server";
import { addDays } from "date-fns";

export async function getDashboardData() {
  const supabase = await createClient();
  
  // 1. 현재 로그인한 사용자 정보 가져오기
  const { data: { user } } = await supabase.auth.getUser();
  
  // 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
  const today = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(today.getTime() + kstOffset).toISOString().split('T')[0];
  
  // 검색 범위 (오늘 ~ 30일 뒤)
  const futureDate = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

  try {
    // ---------------------------------------------------------
    // 1. [오늘] 우리 팀 현황 (오늘 날짜가 포함된 승인된 휴가)
    // ---------------------------------------------------------
    const { data: todayLeaves } = await supabase
      .from("leave_requests")
      .select(`
        id, leave_type, start_date, end_date,
        profiles!inner ( name, department, position, avatar_url )
      `)
      .eq("status", "approved")
      .lte("start_date", kstDate)
      .gte("end_date", kstDate);

    // ---------------------------------------------------------
    // 2. [나의] 다가오는 가장 빠른 휴가 (D-Day용)
    // ---------------------------------------------------------
    let myNextLeave = null;
    if (user) {
      const { data } = await supabase
        .from("leave_requests")
        .select("start_date, leave_type")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .gt("start_date", kstDate) // 오늘 이후
        .order("start_date", { ascending: true })
        .limit(1)
        .single();
      myNextLeave = data;
    }

    // ---------------------------------------------------------
    // 3. [미래] 다가오는 일정 (공휴일 + 동료 휴가)
    // ---------------------------------------------------------
    
    // 3-1. 공휴일 조회
    const { data: holidays } = await supabase
      .from("public_holidays")
      .select("*")
      .gt("date", kstDate)
      .lte("date", futureDate)
      .order("date", { ascending: true });

    // 3-2. 동료들의 다가오는 휴가 (나는 제외할 수도 있음)
    const { data: upcomingLeaves } = await supabase
      .from("leave_requests")
      .select(`
        id, leave_type, start_date, end_date,
        profiles!inner ( name, department )
      `)
      .eq("status", "approved")
      .gt("start_date", kstDate)
      .lte("start_date", futureDate)
      .order("start_date", { ascending: true })
      .limit(5);

    return {
      todayLeaves: todayLeaves || [],
      myNextLeave,
      holidays: holidays || [],
      upcomingLeaves: upcomingLeaves || []
    };

  } catch (error) {
    console.error("대시보드 데이터 조회 실패:", error);
    return { todayLeaves: [], myNextLeave: null, holidays: [], upcomingLeaves: [] };
  }
}
