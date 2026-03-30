"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

// VAPID 공개키를 브라우저가 이해할 수 있는 형식으로 변환하는 함수
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushManager() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false); // ⭐️ [NEW] 배너 표시 여부 상태
  const supabase = createClient();

  useEffect(() => {
    // 1. 이미 알림이 허용되어 있는지 확인
    if ("Notification" in window && Notification.permission === "granted") {
      setIsSubscribed(true);
    }

    // 2. ⭐️ [NEW] 접속 환경 체크 (모바일 여부 & 앱 설치 여부)
    const checkEnvironment = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      
      // PWA(앱)로 설치되어 실행 중인지 확인 (standalone 모드)
      // iOS 사파리를 위한 navigator.standalone 체크 포함
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           ('standalone' in navigator && (navigator as any).standalone === true);

      // 모바일 기기이면서, 앱으로 설치된 상태일 때만 배너를 보여줍니다.
      if (isMobile && isStandalone) {
        setShouldShow(true);
      }
    };

    checkEnvironment();
  }, []);

  const subscribeToPush = async () => {
    try {
      if ("Notification" in window && Notification.permission === "denied") {
        alert("알림이 차단되어 있습니다. 기기 설정에서 알림 권한을 '허용'으로 변경해 주세요.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }

      const { error } = await supabase.from("push_subscriptions").insert({
        user_id: user.id,
        subscription: JSON.parse(JSON.stringify(subscription)),
      });

      if (error && error.code !== "23505") {
        console.error("DB 저장 실패:", error);
        throw error;
      }

      setIsSubscribed(true);
      alert("성공적으로 알림이 설정되었습니다! 🎉");
      
    } catch (error) {
      console.error("푸시 구독 중 에러 발생:", error);
      alert("알림 설정에 실패했습니다. 기기 설정을 확인해 주세요.");
    }
  };

  // ⭐️ [NEW] 조건에 맞지 않거나(PC, 미설치), 이미 구독 중이면 아무것도 렌더링하지 않습니다.
  if (!shouldShow || isSubscribed) return null;

  return (
    <div className="p-4 bg-blue-50 rounded-lg flex items-center justify-between mt-4 animate-in fade-in duration-500">
      <span className="text-sm text-blue-800 font-medium">
        새로운 결재 기안 알림을 받아보세요!
      </span>
      <button
        onClick={subscribeToPush}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 transition shadow-sm"
      >
        알림 켜기
      </button>
    </div>
  );
}
