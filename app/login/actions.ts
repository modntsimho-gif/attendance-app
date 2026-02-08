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
    // ⭐️ 이메일 미인증 에러 등을 구체적으로 표시하기 위해 error.message 포함 가능
    // "Email not confirmed" 에러가 발생할 수 있음
    return `로그인 실패: ${error.message}`;
  }

  revalidatePath("/", "layout");
  redirect("/"); 
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // ⭐️ Next.js 15: headers()는 비동기 함수입니다.
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

  // 2. Supabase Auth 가입 요청 (이메일 인증 링크 포함)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // ⭐️ 인증 링크를 클릭하면 이 주소로 돌아옵니다.
      emailRedirectTo: `${origin}/auth/callback`,
      // 메타데이터에도 정보를 저장해두면 추후 트리거 사용 시 유용합니다.
      data: {
        name,
        department,
        position,
        role,
        join_date: joinDate,
      }
    },
  });

  if (error) {
    return `가입 실패: ${error.message}`;
  }

  // 3. profiles 테이블에 사용자 정보 입력
  // 주의: 이메일 인증이 켜져 있으면 세션이 없을 수 있어 RLS 정책에 따라 실패할 수도 있습니다.
  // 실패하더라도 위 options.data에 정보가 있으므로, 추후 트리거로 복구 가능합니다.
  if (data.user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: data.user.id,
        email: email,
        name: name,
        department: department,
        position: position,
        role: role || 'employee',
        join_date: joinDate || null,
        total_leave_days: 0, 
        used_leave_days: 0,
        extra_leave_days: 0
      });

    if (profileError) {
      console.error("프로필 생성 실패 (트리거가 있다면 무시 가능):", profileError);
    }
  }

  // ⭐️ [중요 수정] 바로 로그인되지 않으므로 redirect("/")를 제거합니다.
  // 대신 null을 반환하여 클라이언트 컴포넌트가 "이메일 확인 화면"을 띄우게 합니다.
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
