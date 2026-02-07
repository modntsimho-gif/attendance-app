"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

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
  redirect("/"); // 👈 여기를 "/"로 수정했습니다 (대시보드 이동)
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const department = formData.get("department") as string;
  const position = formData.get("position") as string;

  // ⭐️ 권한(Role) 자동 부여 로직
  // 부서가 CEO(또는 CBO)이거나, 직급이 사무총장이면 'manager' 권한 부여
  let userRole = 'employee'; // 기본값
  
  // 드롭다운에는 CEO로 되어있지만 혹시 몰라 CBO도 조건에 넣어두었습니다.
  if (department === 'CEO' || department === 'CBO' || position === '사무총장') {
    userRole = 'manager';
  }

  // 1. Supabase Auth 가입 요청
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return `가입 실패: ${error.message}`;
  }

  if (data.user) {
    // 2. profiles 테이블에 사용자 정보 입력 (role 포함)
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: data.user.id,
        email: email,
        name: name,
        department: department,
        position: position,
        role: userRole,        // 👈 판별된 권한 저장
        total_leave_days: 15,  // 기본 연차
        used_leave_days: 0,
        extra_leave_days: 0
      });

    if (profileError) {
      console.error("프로필 생성 실패:", profileError);
    }
  }

  revalidatePath("/", "layout");
  redirect("/"); // 👈 가입 성공 후에도 메인("/")으로 이동
}
