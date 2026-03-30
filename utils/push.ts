import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// web-push 초기 설정
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// 관리자 권한 Supabase 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // 서비스 롤 키 필요
);

interface SendPushParams {
  userId: string;
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification({ userId, title, body, url = "/" }: SendPushParams) {
  try {
    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", userId);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({ title, body, url });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error("푸시 전송 에러:", error);
  }
}
