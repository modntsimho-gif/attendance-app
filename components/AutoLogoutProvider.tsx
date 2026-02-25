"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client"; // Supabase 클라이언트 경로 확인

// ⏳ 제한 시간 설정 (30분 = 30 * 60 * 1000ms)
const TIMEOUT_MS = 30 * 60 * 1000;

export default function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // 로그아웃 처리 함수
  const handleLogout = useCallback(async () => {
    try {
      // 1. Supabase 로그아웃
      await supabase.auth.signOut();
      
      // 2. 알림 및 리다이렉트
      alert("장시간 활동이 없어 자동 로그아웃 되었습니다.");
      router.push("/login"); // 로그인 페이지 경로로 수정하세요
      router.refresh();      // 상태 초기화를 위해 새로고침
    } catch (error) {
      console.error("Logout failed", error);
    }
  }, [router, supabase]);

  // 타이머 리셋 함수
  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(handleLogout, TIMEOUT_MS);
  }, [handleLogout]);

  useEffect(() => {
    // 감지할 이벤트 목록
    const events = [
      "mousedown", // 마우스 클릭
      "mousemove", // 마우스 이동
      "keydown",   // 키보드 입력
      "scroll",    // 스크롤
      "touchstart" // 모바일 터치
    ];

    // 이벤트 리스너 등록
    const setupEvents = () => {
      events.forEach((event) => {
        window.addEventListener(event, resetTimer);
      });
      resetTimer(); // 초기 타이머 시작
    };

    setupEvents();

    // 클린업 (컴포넌트 언마운트 시 리스너 제거)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer]);

  return <>{children}</>;
}
