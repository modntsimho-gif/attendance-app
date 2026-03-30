"use client";

import { useEffect, useState } from "react";

export default function PWAInstallGuard({ children }: { children: React.ReactNode }) {
  // 초기 렌더링 시 깜빡임을 막기 위해 기본값을 true로 설정합니다.
  const [isPWA, setIsPWA] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // 1. 모바일 기기인지 확인
    const checkMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(checkMobile);

    // 2. PWA(독립 실행형)로 실행 중인지 확인
    // iOS Safari의 경우 navigator.standalone을 추가로 체크합니다.
    const isStandalone = 
      window.matchMedia("(display-mode: standalone)").matches || 
      (window.navigator as any).standalone === true;
    
    setIsPWA(isStandalone);
  }, []);

  // 서버 사이드 렌더링 시점에는 아무것도 판단하지 않고 일단 렌더링합니다.
  if (!isMounted) return <>{children}</>;

  // ⭐️ 핵심: 모바일인데 PWA가 아니라면 앱 화면 대신 설치 안내 화면을 띄웁니다.
  if (isMobile && !isPWA) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white p-6 text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">앱 설치가 필요합니다 📱</h1>
        <p className="mb-8 text-gray-600 leading-relaxed">
          사내 결재 요청 및 푸시 알림 수신을 위해<br />
          반드시 홈 화면에 앱을 설치해 주세요.
        </p>
        
        <div className="bg-gray-100 p-5 rounded-xl text-left w-full max-w-sm shadow-sm">
          <h2 className="font-semibold mb-3 text-gray-800">📌 기기별 설치 방법</h2>
          <ul className="space-y-4 text-sm text-gray-700">
            <li className="flex flex-col gap-1">
              <span className="font-bold text-blue-600">🍎 아이폰 (Safari)</span>
              <span>화면 하단의 <b>공유(⍗)</b> 버튼을 누르고<br/> 메뉴에서 <b>[홈 화면에 추가]</b> 선택</span>
            </li>
            <li className="flex flex-col gap-1">
              <span className="font-bold text-blue-600">🍎 아이폰 (Chrome)</span>
              <span>화면 상단 URL창의 오른쪽 끝의 <b>설치(⍐)</b> 아이콘을 누르고<br/> 메뉴에서 <b>[홈 화면에 추가]</b> 선택</span>
            </li>
            <li className="flex flex-col gap-1">
              <span className="font-bold text-green-600">🤖 안드로이드 (Chrome)</span>
              <span>화면 우측 상단의 <b>메뉴(⋮)</b> 버튼을 누르고<br/> <b>[홈 화면에 추가]</b> 또는 <b>[앱 설치]</b> 선택</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // PC 브라우저이거나, 모바일 PWA로 정상 접속한 경우 원래 앱 화면을 보여줍니다.
  return <>{children}</>;
}
