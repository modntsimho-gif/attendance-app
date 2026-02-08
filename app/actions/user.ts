"use server";

import { createClient } from "@/utils/supabase/server";

export async function getApprovers() {
  const supabase = await createClient();

  // 1. 현재 로그인한 사용자 가져오기
  const { data: { user } } = await supabase.auth.getUser();

  // 2. 프로필 테이블 조회
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, position, department")
    .is("resigned_at", null)   // ⭐️ [추가됨] 퇴사일이 없는(NULL) 사람만 조회
    .neq("id", user?.id || "") // 나 자신 제외
    .order("name");

  if (error) {
    console.error("결재자 조회 실패:", error);
    return [];
  }

  // 3. UI 포맷 변환
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    rank: p.position || "직원",
    dept: p.department || "소속미정",
  }));
}
