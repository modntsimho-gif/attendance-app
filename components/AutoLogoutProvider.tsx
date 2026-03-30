"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// ⏳ 제한 시간 설정 (30분 = 30 * 60 * 1000ms)
const TIMEOUT_MS = 30 * 60 * 1000;

export default function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // 로그아웃 처리 함수
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      alert("장시간 활동이 없어 자동 로그아웃 되었습니다.");
      router.push("/login");
      router.refresh();
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
    // ⭐️ 1. PWA(설치형 앱) 모드로 실행 중인지 확인
    const isPWA = window.matchMedia("(display-mode: standalone)").matches;
    
    // ⭐️ 2. 모바일 기기(스마트폰/태블릿)인지 확인
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // 모바일 기기이거나 PWA 앱이라면 자동 로그아웃 타이머를 작동시키지 않습니다.
    if (isPWA || isMobile) {
      console.log("모바일/PWA 환경이므로 자동 로그아웃을 비활성화합니다.");
      return; 
    }

    // 감지할 이벤트 목록 (PC 환경에서만 실행됨)
    const events = [
      "mousedown", 
      "mousemove", 
      "keydown",   
      "scroll",    
      "touchstart" 
    ];

    const setupEvents = () => {
      events.forEach((event) => {
        window.addEventListener(event, resetTimer);
      });
      resetTimer();
    };

    setupEvents();

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
