"use server";

import { createClient } from "@/utils/supabase/server";

export async function getApprovers() {
  const supabase = await createClient();

  // 1. 현재 로그인한 사용자 가져오기
  const { data: { user } } = await supabase.auth.getUser();

  // 2. 프로필 테이블 조회 (기존의 .order("name") 제거)
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, name, position, department, is_approver")
    .is("resigned_at", null)   // 퇴사일이 없는(NULL) 사람만 조회
    .neq("id", user?.id || ""); // 나 자신 제외

  if (error || !profiles) {
    console.error("결재자 조회 실패:", error);
    return [];
  }

  // ⭐️ 3. 정렬 기준(sort_settings) 통합 조회
  const { data: sortData } = await supabase
    .from("sort_settings")
    .select("target_type, target_id, sort_order")
    .in("target_type", ["department", "position", "employee"]);

  const dSortMap = new Map<string, number>(); // 부서 정렬
  const pSortMap = new Map<string, number>(); // 직급 정렬
  const eSortMap = new Map<string, number>(); // 직원 정렬

  if (sortData) {
    sortData.forEach(s => {
      if (s.target_type === 'department') dSortMap.set(s.target_id, s.sort_order);
      if (s.target_type === 'position') pSortMap.set(s.target_id, s.sort_order);
      if (s.target_type === 'employee') eSortMap.set(s.target_id, s.sort_order);
    });
  }

  // ⭐️ 4. 다중 정렬 적용 (부서 -> 직급 -> 직원 순)
  const sortedProfiles = [...profiles].sort((a, b) => {
    // 1순위: 부서 정렬
    const deptA = a.department || "소속미정";
    const deptB = b.department || "소속미정";
    const dOrderA = dSortMap.get(deptA) ?? 999;
    const dOrderB = dSortMap.get(deptB) ?? 999;
    
    if (dOrderA !== dOrderB) return dOrderA - dOrderB;

    // 2순위: 직급 정렬
    const posA = a.position || "직원";
    const posB = b.position || "직원";
    const pOrderA = pSortMap.get(posA) ?? 999;
    const pOrderB = pSortMap.get(posB) ?? 999;
    
    if (pOrderA !== pOrderB) return pOrderA - pOrderB;

    // 3순위: 직원 개별 정렬
    const eOrderA = eSortMap.get(a.id) ?? 999;
    const eOrderB = eSortMap.get(b.id) ?? 999;
    
    return eOrderA - eOrderB;
  });

  // 5. UI 포맷 변환
  return sortedProfiles.map((p) => ({
    id: p.id,
    name: p.name,
    rank: p.position || "직원",
    dept: p.department || "소속미정",
    is_approver: p.is_approver || false, // DB 값이 null일 경우를 대비해 기본값 false 지정
  }));
}
