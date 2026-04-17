"use server";

import { createClient } from "@/utils/supabase/server";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, parseISO } from "date-fns";

// ⭐️ 기본 색상 제공 함수
const EVENT_COLORS = [
  "#FCA5A5", "#FDBA74", "#FCD34D", "#86EFAC", "#67E8F9", 
  "#93C5FD", "#C4B5FD", "#F9A8D4", "#F87171", "#60A5FA"
];

function getDefaultUserColor(userId: string) {
  if (!userId) return "#CBD5E1"; 
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

// ⭐️ 데이터 그룹화 및 최신 상태 필터링 함수
function filterLatestEvents(data: any[]) {
  if (!data || data.length === 0) return [];

  const itemMap = new Map<string, any>();
  const parentMap = new Map<string, string>();

  data.forEach((item) => {
    itemMap.set(item.id, item);
    const parentId = item.original_leave_request_id || item.original_overtime_request_id;
    if (parentId) {
      parentMap.set(item.id, parentId);
    }
  });

  const findRootId = (currentId: string): string => {
    let pointer = currentId;
    while (parentMap.has(pointer)) {
      const parentId = parentMap.get(pointer)!;
      if (!itemMap.has(parentId)) break;
      pointer = parentId;
    }
    return pointer;
  };

  const groups: Record<string, any[]> = {};
  data.forEach((item) => {
    const rootId = findRootId(item.id);
    if (!groups[rootId]) groups[rootId] = [];
    groups[rootId].push(item);
  });

  const validItems: any[] = [];

  Object.values(groups).forEach((group) => {
    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = group[0];

    if (latest.request_type === 'cancel') return;
    if (latest.status === 'rejected') return;
    if (latest.status !== 'approved') return;

    validItems.push(latest);
  });

  return validItems;
}

export async function getCalendarEvents(
  userId: string | undefined, 
  currentDate: Date | string 
) {
  const supabase = await createClient();
  
  // 1. 현재 로그인한 사용자 정보 가져오기
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { leaves: [], overtimes: [], holidays: [] };

  const current = typeof currentDate === 'string' ? new Date(currentDate) : currentDate;
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(monthStart);
  const viewStart = startOfWeek(monthStart);
  const viewEnd = endOfWeek(monthEnd);

  const startDateStr = format(viewStart, "yyyy-MM-dd");
  const endDateStr = format(viewEnd, "yyyy-MM-dd");
  
  // 2. 휴가 전체 조회
  let leavesQuery = supabase
    .from("leave_requests")
    .select("*, profiles!inner(name, position, department)")
    .neq("profiles.department", "외주");
    
  if (userId) {
    leavesQuery = leavesQuery.eq("user_id", userId);
  }
  const { data: allLeaves } = await leavesQuery;

  // 2.5 초과근무 전체 조회
  let overtimesQuery = supabase
    .from("overtime_requests")
    .select("*, profiles!inner(name, position, department)")
    .eq("profiles.department", "외주악");
    
  if (userId) {
    overtimesQuery = overtimesQuery.eq("user_id", userId);
  }
  const { data: allOvertimes } = await overtimesQuery;

  // 3. 공휴일 조회
  const { data: holidays } = await supabase
    .from("public_holidays")
    .select("id, date, title")
    .gte("date", startDateStr)
    .lte("date", endDateStr);

  // 4. 커스텀 색상 목록 조회
  const { data: colorPrefs } = await supabase
    .from("user_color_preferences")
    .select("target_user_id, color")
    .eq("user_id", currentUser.id);

  const customColorMap = new Map();
  if (colorPrefs) {
    colorPrefs.forEach(pref => {
      customColorMap.set(pref.target_user_id, pref.color);
    });
  }

  // 5. 직급 및 직원 정렬 기준 통합 조회
  const { data: sortData } = await supabase
    .from("sort_settings")
    .select("target_type, target_id, sort_order")
    .in("target_type", ["position", "employee"]);

  const pSortMap = new Map<string, number>();
  const eSortMap = new Map<string, number>();

  if (sortData) {
    sortData.forEach(s => {
      if (s.target_type === 'position') pSortMap.set(s.target_id, s.sort_order);
      if (s.target_type === 'employee') eSortMap.set(s.target_id, s.sort_order);
    });
  }

  // 6. 최신 상태 필터링 및 날짜 범위 필터링
  const latestLeaves = filterLatestEvents(allLeaves || []);
  const finalLeaves = latestLeaves.filter(leave => {
    const leaveStart = parseISO(leave.start_date);
    const leaveEnd = parseISO(leave.end_date);
    return (leaveStart <= viewEnd) && (leaveEnd >= viewStart);
  });

  const latestOvertimes = filterLatestEvents(allOvertimes || []);
  const finalOvertimes = latestOvertimes.filter(ot => {
    const workDate = parseISO(ot.work_date);
    return (workDate <= viewEnd) && (workDate >= viewStart);
  });

  // 7. 데이터 가공 (휴가)
  const formattedLeaves = finalLeaves.map(leave => {
    const userName = leave.profiles?.name || "알 수 없음";
    const targetUserId = leave.user_id;
    const finalColor = customColorMap.get(targetUserId) || getDefaultUserColor(targetUserId);

    return {
      ...leave,
      department: leave.profiles?.department || "소속 없음",
      leave_type: `[${userName}] ${leave.leave_type}`,
      color: finalColor,
      _pos: leave.profiles?.position || ""
    };
  });

  // ⭐️ 7.5 데이터 가공 (초과근무)
  const formattedOvertimes = finalOvertimes.map(ot => {
    const userName = ot.profiles?.name || "알 수 없음";
    const targetUserId = ot.user_id;
    
    // 연차와 완벽하게 동일한 색상 로직 적용
    const finalColor = customColorMap.get(targetUserId) || getDefaultUserColor(targetUserId);

    return {
      ...ot,
      user_name: userName,
      department: ot.profiles?.department || "소속 없음",
      // ⭐️ 요청하신 텍스트 포맷 적용
      title: `[${userName}] 초과근무 ${ot.total_hours}시간`,
      color: finalColor, 
      _pos: ot.profiles?.position || ""
    };
  });

  // 8. 직급 ➡️ 직원 순서로 정렬 적용
  const sortLogic = (a: any, b: any) => {
    const pOrderA = pSortMap.get(a._pos) ?? 999;
    const pOrderB = pSortMap.get(b._pos) ?? 999;
    if (pOrderA !== pOrderB) return pOrderA - pOrderB;

    const eOrderA = eSortMap.get(a.user_id) ?? 999;
    const eOrderB = eSortMap.get(b.user_id) ?? 999;
    return eOrderA - eOrderB;
  };

  formattedLeaves.sort(sortLogic);
  formattedOvertimes.sort(sortLogic);

  // 클라이언트로 넘기기 전 임시 데이터(_pos) 제거
  const cleanedLeaves = formattedLeaves.map(({ _pos, ...rest }) => rest);
  const cleanedOvertimes = formattedOvertimes.map(({ _pos, ...rest }) => rest);

  return {
    leaves: cleanedLeaves,
    overtimes: cleanedOvertimes,
    holidays: holidays || []
  };
}
