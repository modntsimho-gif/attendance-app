"use server";

import { createClient } from "@/utils/supabase/server";

export async function getApprovers() {
  const supabase = await createClient();

  // 1. 현재 로그인한 사용자 가져오기 (나 자신은 결재자 목록에서 빼기 위함)
  const { data: { user } } = await supabase.auth.getUser();

  // 2. 프로필 테이블 조회 (나 제외, 이름순 정렬)
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, position, department")
    .neq("id", user?.id || "") 
    .order("name");

  if (error) {
    console.error("결재자 조회 실패:", error);
    return [];
  }

  // 3. UI에 맞는 포맷으로 변환 (DB: position -> UI: rank)
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    rank: p.position || "직원",
    dept: p.department || "소속미정",
  }));
}
