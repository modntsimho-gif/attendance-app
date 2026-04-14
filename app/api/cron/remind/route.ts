import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/utils/push";

export async function GET(req: Request) {
  try {
    // ⭐️ Vercel Cron 보안 체크: 외부에서 아무나 이 주소로 접속해서 알림을 쏘는 것을 방지합니다.
    // Vercel 환경 변수에 CRON_SECRET을 설정해두면 좋습니다.
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // ⭐️ 핵심 로직: 현재 시간 기준으로 1시간 이전의 시간을 계산합니다.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // 1. 상태가 pending이면서, 생성된 지 1시간이 지난 결재 라인만 조회
    const { data: pendingApprovals, error } = await supabase
      .from("approval_lines")
      .select("*")
      .eq("status", "pending")
      .lte("created_at", oneHourAgo); // created_at이 1시간 전보다 작거나 같은(오래된) 데이터

    if (error || !pendingApprovals || pendingApprovals.length === 0) {
      return NextResponse.json({ message: "1시간 이상 지연된 결재 없음" });
    }

    // 2. 지연된 결재자들에게 각각 푸시 발송
    const sendPromises = pendingApprovals.map(async (record) => {
      const docTypeName = record.leave_request_id ? "연차신청서" : "초과근무신청서";
      
      const pushTitle = `[결재요청] ${docTypeName} 미결재 알림`;
      const pushBody = `대기 중인 결재 건이 있습니다.`;

      console.log(`푸시 발송: 결재자 ${record.approver_id}`);

      return sendPushNotification({
        userId: record.approver_id,
        title: pushTitle,
        body: pushBody,
      });
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, count: pendingApprovals.length });
  } catch (error) {
    console.error("독촉 스케줄러 에러:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
