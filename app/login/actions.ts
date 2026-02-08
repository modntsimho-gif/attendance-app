"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers"; 

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return `로그인 실패: ${error.message}`;
  }

  revalidatePath("/", "layout");
  redirect("/"); 
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // Next.js 15: headers()는 비동기 함수
  const headersList = await headers();
  const origin = headersList.get("origin");

  // 1. 폼 데이터 가져오기
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const department = formData.get("department") as string;
  const position = formData.get("position") as string;
  const joinDate = formData.get("join_date") as string; 
  const role = formData.get("role") as string; 

  // 2. Supabase Auth 가입 요청
  // ⭐️ 핵심: options.data에 정보를 담아 보내면 DB 트리거가 profiles 테이블로 옮겨줍니다.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        name,
        department,
        position,
        role: role || 'employee',
        join_date: joinDate,
        // 트리거에서 total_leave_days 등은 기본값(0)으로 처리하므로 여기선 안 보내도 됩니다.
      }
    },
  });

  if (error) {
    return `가입 실패: ${error.message}`;
  }

  // 🗑️ [삭제됨] 수동 insert 로직 제거
  // 이메일 인증 전에는 세션이 없어 insert가 실패하므로, DB 트리거에 맡깁니다.

  // 성공 시 null 반환 -> 프론트엔드에서 "메일 확인" 화면 표시
  return null; 
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  
  const headersList = await headers();
  const origin = headersList.get("origin");

  if (!email) {
    return "이메일을 입력해주세요.";
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/`, 
  });

  if (error) {
    return `전송 실패: ${error.message}`;
  }

  return "success";
}
