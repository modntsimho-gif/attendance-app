import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// web-push 초기 설정
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// 관리자 권한으로 DB를 조회하기 위한 Supabase Admin 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 서비스 롤 키 필요
);

interface SendPushParams {
  userId: string; // 알림을 받을 대상 유저 ID
  title: string;  // 알림 제목
  body: string;   // 알림 내용
  url?: string;   // 알림 클릭 시 이동할 주소 (선택)
}

export async function sendPushNotification({ userId, title, body, url = "/" }: SendPushParams) {
  try {
    // 1. 해당 유저의 구독 정보(기기들)를 DB에서 모두 가져옵니다.
    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", userId);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`유저(${userId})의 푸시 구독 정보가 없습니다.`);
      return;
    }

    // 2. 보낼 메시지 내용 구성
    const payload = JSON.stringify({
      title,
      body,
      url,
    });

    // 3. 유저가 등록한 모든 기기(PC, 폰 등)에 알림 전송
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (err: any) {
        // 만약 사용자가 브라우저에서 알림 권한을 취소했거나, 구독이 만료된 경우 (410, 404 에러)
        // DB에서 해당 쓰레기 데이터를 삭제해 줍니다.
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log("만료된 구독 정보 삭제 중...");
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("푸시 전송 실패:", err);
        }
      }
    });

    await Promise.all(sendPromises);
    console.log(`유저(${userId})에게 푸시 알림 전송 완료!`);

  } catch (error) {
    console.error("sendPushNotification 실행 중 에러:", error);
  }
}
