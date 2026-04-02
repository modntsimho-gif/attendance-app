"use server";

import { createClient } from "@/utils/supabase/server";

export async function getApprovers() {
  const supabase = await createClient();

  // 1. 현재 로그인한 사용자 가져오기
  const { data: { user } } = await supabase.auth.getUser();

  // 2. 프로필 테이블 조회 (⭐️ is_approver 추가)
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, position, department, is_approver")
    .is("resigned_at", null)   // 퇴사일이 없는(NULL) 사람만 조회
    .neq("id", user?.id || "") // 나 자신 제외
    .order("name");

  if (error) {
    console.error("결재자 조회 실패:", error);
    return [];
  }

  // 3. UI 포맷 변환 (⭐️ is_approver 매핑 추가)
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    rank: p.position || "직원",
    dept: p.department || "소속미정",
    is_approver: p.is_approver || false, // DB 값이 null일 경우를 대비해 기본값 false 지정
  }));
}
