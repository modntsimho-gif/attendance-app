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
    // 실제 프로덕션에서는 에러 메시지를 UI에 표시하는 처리가 필요합니다.
    console.error("Login Error:", error.message);
    return redirect("/login?error=true");
  }

  // 로그인 성공 시 캐시 갱신 후 메인 페이지로 이동
  revalidatePath("/", "layout");
  redirect("/");
}