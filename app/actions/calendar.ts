"use server";

import { createClient } from "@/utils/supabase/server";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, parseISO } from "date-fns";

// ⭐️ 기본 색상 제공 함수 (사용자가 커스텀 색상을 지정하지 않았을 때 사용)
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
    .select("*, profiles(name)");
    
  if (userId) {
    leavesQuery = leavesQuery.eq("user_id", userId);
  }
  const { data: allLeaves } = await leavesQuery;

  // 3. 공휴일 조회
  const { data: holidays } = await supabase
    .from("public_holidays")
    .select("id, date, title")
    .gte("date", startDateStr)
    .lte("date", endDateStr);

  // ⭐️ 4. [NEW] 현재 로그인한 사용자가 설정한 '커스텀 색상' 목록 조회
  const { data: colorPrefs } = await supabase
    .from("user_color_preferences")
    .select("target_user_id, color")
    .eq("user_id", currentUser.id);

  // 빠른 검색을 위해 Map 객체로 변환 (예: { '동료ID': '#FF0000' })
  const customColorMap = new Map();
  if (colorPrefs) {
    colorPrefs.forEach(pref => {
      customColorMap.set(pref.target_user_id, pref.color);
    });
  }

  // 5. 최신 상태 필터링 및 날짜 범위 필터링
  const latestLeaves = filterLatestEvents(allLeaves || []);
  const finalLeaves = latestLeaves.filter(leave => {
    const leaveStart = parseISO(leave.start_date);
    const leaveEnd = parseISO(leave.end_date);
    return (leaveStart <= viewEnd) && (leaveEnd >= viewStart);
  });

  // ⭐️ 6. 데이터 가공 (이름 + 커스텀 색상 적용)
  const formattedLeaves = finalLeaves.map(leave => {
    const userName = leave.profiles?.name || "알 수 없음";
    const targetUserId = leave.user_id;
    
    // 사용자가 지정한 색상이 있으면 쓰고, 없으면 기본 해시 색상 사용
    const finalColor = customColorMap.get(targetUserId) || getDefaultUserColor(targetUserId);

    return {
      ...leave,
      leave_type: `[${userName}] ${leave.leave_type}`,
      color: finalColor 
    };
  });

  return {
    leaves: formattedLeaves,
    overtimes: [], 
    holidays: holidays || []
  };
}
