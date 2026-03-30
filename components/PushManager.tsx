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
  const supabase = createClient();

  useEffect(() => {
    // 이미 알림이 허용되어 있는지 확인
    if ("Notification" in window && Notification.permission === "granted") {
      setIsSubscribed(true);
    }
  }, []);

  const subscribeToPush = async () => {
    try {
      // 1. 서비스 워커 등록 확인
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 2. 푸시 구독 생성 (여기에 아까 .env에 넣은 공개키가 사용됩니다)
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      console.log("현재 구워진 VAPID 키:", publicVapidKey); // 👈 이 줄을 추가
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      // 3. 현재 로그인한 유저 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }

      // 4. Supabase DB에 구독 정보 저장
      const { error } = await supabase.from("push_subscriptions").insert({
        user_id: user.id,
        subscription: JSON.parse(JSON.stringify(subscription)),
      });

      // 이미 등록된 기기 에러(23505)는 무시
      if (error && error.code !== "23505") {
        console.error("DB 저장 실패:", error);
        throw error;
      }

      setIsSubscribed(true);
      alert("성공적으로 알림이 설정되었습니다! 🎉");
      
    } catch (error) {
      console.error("푸시 구독 중 에러 발생:", error);
      alert("알림 설정에 실패했습니다. 브라우저 설정을 확인해 주세요.");
    }
  };

  // 이미 구독 중이면 버튼을 숨깁니다.
  if (isSubscribed) return null;

  return (
    <div className="p-4 bg-blue-50 rounded-lg flex items-center justify-between mt-4">
      <span className="text-sm text-blue-800">
        새로운 결재 기안 알림을 받아보세요!
      </span>
      <button
        onClick={subscribeToPush}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
      >
        알림 켜기
      </button>
    </div>
  );
}
