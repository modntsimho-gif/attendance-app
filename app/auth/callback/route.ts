import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // next 파라미터가 있으면 그곳으로, 없으면 홈(/)으로 이동
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 에러 발생 시 에러 페이지로 리다이렉트 (혹은 로그인 페이지로)
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
