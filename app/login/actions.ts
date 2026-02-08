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

  // 1. 폼 데이터 가져오기
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const department = formData.get("department") as string;
  const position = formData.get("position") as string;
  const joinDate = formData.get("join_date") as string; 
  const role = formData.get("role") as string; 

  // 2. Supabase Auth 가입 요청
  // ⭐️ 이메일 인증을 껐으므로, 가입 즉시 로그인 세션이 생성됩니다.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // data 객체는 트리거가 profiles 테이블로 정보를 옮길 때 사용됩니다.
      data: {
        name,
        department,
        position,
        role: role || 'employee',
        join_date: joinDate,
      }
    },
  });

  if (error) {
    return `가입 실패: ${error.message}`;
  }

  // 3. 가입 성공 시 바로 메인으로 이동
  revalidatePath("/", "layout");
  redirect("/"); 
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
