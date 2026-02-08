"use server";

import { createClient } from "@/utils/supabase/server";
import { addDays, format, parseISO } from "date-fns";

// ⭐️ [공통 로직] 휴가 데이터 그룹화 및 최신 유효 데이터 필터링
function filterValidLeaves(leaves: any[]) {
  if (!leaves || leaves.length === 0) return [];

  const itemMap = new Map<string, any>();
  const parentMap = new Map<string, string>();

  // 1. 매핑
  leaves.forEach((item) => {
    itemMap.set(item.id, item);
    if (item.original_leave_request_id) {
      parentMap.set(item.id, item.original_leave_request_id);
    }
  });

  // 2. 루트 ID 찾기
  const findRootId = (currentId: string): string => {
    let pointer = currentId;
    while (parentMap.has(pointer)) {
      const parentId = parentMap.get(pointer)!;
      if (!itemMap.has(parentId)) break;
      pointer = parentId;
    }
    return pointer;
  };

  // 3. 그룹핑
  const groups: Record<string, any[]> = {};
  leaves.forEach((item) => {
    const rootId = findRootId(item.id);
    if (!groups[rootId]) groups[rootId] = [];
    groups[rootId].push(item);
  });

  // 4. 최신 상태 추출 및 유효성 검사
  const validItems: any[] = [];
  Object.values(groups).forEach((group) => {
    // 최신순 정렬 (created_at 내림차순)
    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = group[0];

    // ❌ 제외 조건:
    // 1. 취소(cancel) 신청인 경우
    // 2. 상태가 반려(rejected) 또는 취소(cancelled)인 경우
    if (latest.request_type === 'cancel') return;
    if (latest.status === 'rejected' || latest.status === 'cancelled') return;

    // ✅ 통과된 항목만 추가
    validItems.push(latest);
  });

  return validItems;
}

export async function getDashboardData() {
  const supabase = await createClient();
  
  // 1. 현재 로그인한 사용자 정보
  const { data: { user } } = await supabase.auth.getUser();
  
  // 날짜 기준 설정 (KST)
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const todayDate = new Date(now.getTime() + kstOffset);
  const kstDateStr = todayDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // 검색 범위: 오늘 ~ 30일 뒤
  const futureDateStr = new Date(todayDate.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

  try {
    // ---------------------------------------------------------
    // 1. [휴가 데이터 통합 조회]
    // ---------------------------------------------------------
    const { data: rawLeaves } = await supabase
      .from("leave_requests")
      .select(`
        id, leave_type, start_date, end_date, status, request_type, created_at, user_id, original_leave_request_id,
        profiles!inner ( name, department, position, avatar_url )
      `)
      .gte("end_date", kstDateStr);

    // ⭐️ 데이터 정제
    const validLeaves = filterValidLeaves(rawLeaves || []);

    // ---------------------------------------------------------
    // 2. [데이터 분류]
    // ---------------------------------------------------------

    // A. [오늘] 휴가자
    const todayLeaves = validLeaves.filter(l => 
      l.status === 'approved' && 
      l.start_date <= kstDateStr && 
      l.end_date >= kstDateStr
    );

    // B. [나의] 다음 휴가
    let myNextLeave = null;
    if (user) {
      const myFutureLeaves = validLeaves
        .filter(l => 
          l.user_id === user.id && 
          l.status === 'approved' && 
          l.start_date > kstDateStr
        )
        .sort((a, b) => a.start_date.localeCompare(b.start_date));
      
      if (myFutureLeaves.length > 0) {
        myNextLeave = myFutureLeaves[0];
      }
    }

    // C. [미래] 동료들의 휴가
    const upcomingLeaves = validLeaves
      .filter(l => 
        l.status === 'approved' && 
        l.start_date > kstDateStr && 
        l.start_date <= futureDateStr
      )
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 10);

    // ---------------------------------------------------------
    // 3. [공휴일] 조회
    // ---------------------------------------------------------
    const { data: holidays } = await supabase
      .from("public_holidays")
      .select("*")
      .gt("date", kstDateStr)
      .lte("date", futureDateStr)
      .order("date", { ascending: true });

    return {
      todayLeaves,
      myNextLeave,
      holidays: holidays || [],
      upcomingLeaves
    };

  } catch (error) {
    console.error("대시보드 데이터 조회 실패:", error);
    return { todayLeaves: [], myNextLeave: null, holidays: [], upcomingLeaves: [] };
  }
}

// ⭐️ [NEW] 올해 기준 연차 정보 가져오기 (대시보드용)
export async function getMyCurrentYearStats() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const currentYear = new Date().getFullYear();

  // 프로필과 연차 할당 테이블(Join) 조회
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      total_leave_days,
      annual_leave_allocations (
        year,
        total_days
      )
    `)
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  // 1. 올해 설정된 연차가 있는지 확인
  const thisYearAlloc = profile.annual_leave_allocations?.find(
    (a: any) => a.year === currentYear
  );

  // 2. 있으면 그 값, 없으면 프로필 기본값 사용
  const realTotalLeave = thisYearAlloc 
    ? thisYearAlloc.total_days 
    : (profile.total_leave_days || 0);

  return { totalLeave: realTotalLeave };
}
