"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

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
  const [shouldShow, setShouldShow] = useState(false);
  // ⭐️ [NEW] 로딩 상태 추가 (중복 클릭 방지)
  const [isSubscribing, setIsSubscribing] = useState(false); 
  const supabase = createClient();

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setIsSubscribed(true);
    }

    const checkEnvironment = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           ('standalone' in navigator && (navigator as any).standalone === true);

      if (isMobile && isStandalone) {
        setShouldShow(true);
      }
    };

    checkEnvironment();
  }, []);

  const subscribeToPush = async () => {
    // ⭐️ [NEW] 이미 실행 중이면 무시합니다.
    if (isSubscribing) return;
    
    try {
      setIsSubscribing(true); // 로딩 시작

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
    } finally {
      setIsSubscribing(false); // ⭐️ [NEW] 성공하든 실패하든 로딩 상태 해제
    }
  };

  if (!shouldShow || isSubscribed) return null;

  return (
    <div className="p-4 bg-blue-50 rounded-lg flex items-center justify-between mt-4 animate-in fade-in duration-500">
      <span className="text-sm text-blue-800 font-medium">
        결재 기안 등의 알림을 받아보세요!
      </span>
      <button
        onClick={subscribeToPush}
        disabled={isSubscribing} // ⭐️ [NEW] 로딩 중일 때 버튼 비활성화
        className={`px-4 py-2 text-white text-sm font-bold rounded-md transition shadow-sm ${
          isSubscribing 
            ? "bg-blue-400 cursor-not-allowed" // 로딩 중 스타일
            : "bg-blue-600 hover:bg-blue-700"  // 평상시 스타일
        }`}
      >
        {isSubscribing ? "설정 중..." : "알림 켜기"}
      </button>
    </div>
  );
}
