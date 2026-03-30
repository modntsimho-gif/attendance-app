import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/utils/push"; // 👈 경로가 맞는지 확인해 주세요!

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { type, record } = payload;

    // approval_lines에 새 결재 라인이 추가(INSERT) 되었을 때
    if (type === "INSERT" && record.status === "pending") {
      
      // 관리자 권한으로 DB 조회를 위한 Supabase 클라이언트 생성
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      let docTypeName = "";
      let requesterId = null;

      // ⭐️ 1. 문서 종류 파악 및 기안자(user_id) 조회
      if (record.leave_request_id) {
        docTypeName = "연차신청서";
        const { data } = await supabase
          .from("leave_requests")
          .select("user_id")
          .eq("id", record.leave_request_id)
          .single();
        
        requesterId = data?.user_id;
        
      } else if (record.overtime_request_id) {
        docTypeName = "초과근무신청서";
        const { data } = await supabase
          .from("overtime_requests")
          .select("user_id")
          .eq("id", record.overtime_request_id)
          .single();
        
        requesterId = data?.user_id;
      }

      // ⭐️ 2. 기안자 이름(profiles) 조회
      let requesterName = "직원";
      if (requesterId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", requesterId)
          .single();
          
        if (profile?.name) {
          requesterName = profile.name;
        }
      }

      // ⭐️ 3. 요청하신 알림 문구 조립
      const pushTitle = `[결재요청]${docTypeName}`;
      const pushBody = `${requesterName} 님께서 결재를 요청하셨습니다.결재함을 확인해주세요.`;

      console.log(`🔔 푸시 발송 준비 완료: ${pushTitle} / ${pushBody}`);

      // ⭐️ 4. 푸시 발송
      await sendPushNotification({
        userId: record.approver_id,
        title: pushTitle,
        body: pushBody,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "푸시 발송 조건 아님" });
  } catch (error) {
    console.error("웹훅 에러:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
