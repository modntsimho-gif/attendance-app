"use server";

import { createClient } from "@/utils/supabase/server";

// 1. 내 결재선 목록 가져오기
export async function getSavedLines() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("saved_approval_lines")
    .select("*")
    .order("created_at", { ascending: false });

  return data || [];
}

// 2. 결재선 저장하기
export async function saveLine(title: string, approvers: any[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("saved_approval_lines")
    .insert({
      user_id: user.id,
      title,
      approvers, // JSON 배열 그대로 저장
    });

  if (error) return { error: error.message };
  return { success: true };
}

// 3. 결재선 삭제하기
export async function deleteLine(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_approval_lines")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}
