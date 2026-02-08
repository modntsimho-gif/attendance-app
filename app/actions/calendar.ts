"use server";

import { createClient } from "@/utils/supabase/server";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, isWithinInterval, parseISO } from "date-fns";

// ⭐️ 데이터 그룹화 및 최신 상태 필터링 함수
function filterLatestEvents(data: any[]) {
  if (!data || data.length === 0) return [];

  const itemMap = new Map<string, any>();
  const parentMap = new Map<string, string>();

  // 1. 매핑
  data.forEach((item) => {
    itemMap.set(item.id, item);
    // original_..._id 필드명을 동적으로 찾기 (leave 또는 overtime)
    const parentId = item.original_leave_request_id || item.original_overtime_request_id;
    if (parentId) {
      parentMap.set(item.id, parentId);
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
  data.forEach((item) => {
    const rootId = findRootId(item.id);
    if (!groups[rootId]) groups[rootId] = [];
    groups[rootId].push(item);
  });

  // 4. 각 그룹에서 '최신' 항목만 추출하고, 유효성 검사
  const validItems: any[] = [];

  Object.values(groups).forEach((group) => {
    // 최신순 정렬
    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = group[0];

    // ❌ 제외 조건:
    // 1. 최신 상태가 '취소(cancel)' 신청인 경우 (달력에서 제거)
    // 2. 최신 상태가 '반려(rejected)'인 경우 (단, 변경 반려 시 원본 유지는 복잡하므로 여기선 단순화하여 미노출 처리하거나, 필요시 로직 강화)
    //    -> 보통 변경 반려되면 이전 승인건이 유효해야 하나, UI 복잡도를 줄이기 위해 반려건은 제외합니다.
    if (latest.request_type === 'cancel') return;
    if (latest.status === 'rejected') return;

    validItems.push(latest);
  });

  return validItems;
}

export async function getCalendarEvents(
  userId: string | undefined, 
  currentDate: Date | string 
) {
  const supabase = await createClient();
  let targetId = userId;

  if (!targetId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { leaves: [], overtimes: [], holidays: [] };
    targetId = user.id;
  }

  // 달력 표시 범위 계산
  const current = typeof currentDate === 'string' ? new Date(currentDate) : currentDate;
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(monthStart);
  const viewStart = startOfWeek(monthStart);
  const viewEnd = endOfWeek(monthEnd);

  const startDateStr = format(viewStart, "yyyy-MM-dd");
  const endDateStr = format(viewEnd, "yyyy-MM-dd");

  // ⭐️ 중요: 히스토리 추적을 위해 날짜 필터 없이 해당 유저의 '모든' 데이터를 가져온 뒤 메모리에서 필터링합니다.
  // (데이터가 수만 건이 아닌 이상, 개인 대시보드에서는 이 방식이 데이터 무결성에 가장 좋습니다)
  
  // 1. 휴가 전체 조회
  const { data: allLeaves } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", targetId);

  // 2. 초과근무 전체 조회
  const { data: allOvertimes } = await supabase
    .from("overtime_requests")
    .select("*")
    .eq("user_id", targetId);

  // 3. 공휴일 조회 (날짜 범위로 필터링 가능)
  const { data: holidays } = await supabase
    .from("public_holidays")
    .select("id, date, title")
    .gte("date", startDateStr)
    .lte("date", endDateStr);

  // ⭐️ 4. 로직 적용: 최신 상태만 남기기
  const latestLeaves = filterLatestEvents(allLeaves || []);
  const latestOvertimes = filterLatestEvents(allOvertimes || []);

  // ⭐️ 5. 날짜 범위 필터링 (현재 달력 뷰에 보이는 것만 남기기)
  const finalLeaves = latestLeaves.filter(leave => {
    // 휴가 기간이 달력 뷰와 겹치는지 확인
    const leaveStart = parseISO(leave.start_date);
    const leaveEnd = parseISO(leave.end_date);
    return (leaveStart <= viewEnd) && (leaveEnd >= viewStart);
  });

  const finalOvertimes = latestOvertimes.filter(ot => {
    const workDate = parseISO(ot.work_date);
    return workDate >= viewStart && workDate <= viewEnd;
  });

  return {
    leaves: finalLeaves,
    overtimes: finalOvertimes,
    holidays: holidays || []
  };
}
