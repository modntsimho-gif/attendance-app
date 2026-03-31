"use client";

export default function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
  // 🗑️ 타이머, 이벤트 리스너, Supabase 로그아웃 로직을 모두 제거했습니다.
  // 이제 이 컴포넌트는 아무런 동작도 하지 않고 화면(children)만 그대로 통과시킵니다.
  
  return <>{children}</>;
}