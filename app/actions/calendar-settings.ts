"use server";

import { createClient } from "@/utils/supabase/server";

// 1. 동료 목록과 내가 설정한 색상 불러오기
export async function getColleaguesColors() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, department")
    .neq("id", user.id);

  const { data: preferences } = await supabase
    .from("user_color_preferences")
    .select("target_user_id, color")
    .eq("user_id", user.id);

  return { 
    profiles: profiles || [], 
    preferences: preferences || [] 
  };
}

// 2. 특정 동료 1명의 색상 저장하기
export async function saveColleagueColor(targetUserId: string, color: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { error } = await supabase
    .from("user_color_preferences")
    .upsert({ 
      user_id: user.id, 
      target_user_id: targetUserId, 
      color 
    }, { onConflict: 'user_id, target_user_id' });

  if (error) throw new Error("색상을 저장하지 못했습니다.");
  return { success: true };
}

// ⭐️ 3. [NEW] 부서 전체 인원의 색상을 한 번에 저장하기 (Bulk Upsert)
export async function saveBulkColleagueColors(updates: { target_user_id: string; color: string }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  // DB에 넣을 배열 형태로 데이터 가공
  const payload = updates.map(update => ({
    user_id: user.id,
    target_user_id: update.target_user_id,
    color: update.color
  }));

  const { error } = await supabase
    .from("user_color_preferences")
    .upsert(payload, { onConflict: 'user_id, target_user_id' });

  if (error) {
    console.error("일괄 색상 저장 실패:", error);
    throw new Error("부서 색상을 일괄 저장하지 못했습니다.");
  }
  
  return { success: true };
}
