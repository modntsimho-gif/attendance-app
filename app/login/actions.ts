"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers"; // ⭐️ 헤더 추가

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return "로그인 실패: 이메일 또는 비밀번호를 확인하세요.";
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
  
  // ⭐️ [추가됨] 프론트에서 넘겨준 입사일과 권한 가져오기
  const joinDate = formData.get("join_date") as string; 
  const role = formData.get("role") as string; 

  // 2. Supabase Auth 가입 요청
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return `가입 실패: ${error.message}`;
  }

  if (data.user) {
    // 3. profiles 테이블에 사용자 정보 입력
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: data.user.id,
        email: email,
        name: name,
        department: department,
        position: position,
        
        // ⭐️ [수정됨] 선택한 권한과 입사일 저장
        role: role || 'employee', // 값이 없으면 기본값 employee
        join_date: joinDate || null, // 값이 없으면 null
        
        // 초기 연차 설정 (일단 15개로 고정하거나, 필요시 0으로 설정 후 관리자가 부여)
        total_leave_days: 0, 
        used_leave_days: 0,
        extra_leave_days: 0
      });

    if (profileError) {
      console.error("프로필 생성 실패:", profileError);
      // 프로필 생성 실패 시 Auth 계정도 지워주는 로직이 있으면 좋지만, 여기선 생략
    }
  }

  revalidatePath("/", "layout");
  redirect("/"); 
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  
  // ⭐️ [수정] Next.js 15에서는 headers()가 비동기 함수입니다.
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