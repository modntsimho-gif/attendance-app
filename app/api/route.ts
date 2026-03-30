import { NextResponse } from "next/server";
import { sendPushNotification } from "@/utils/push";
import { createClient } from "@supabase/supabase-js";

// 관리자 권한 Supabase 클라이언트 (DB 조회를 위해 필요)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // 서비스 롤 키 필요
);

export async function POST(req: Request) {
  try {
    // Supabase 웹훅에서 보낸 데이터(Payload) 받기
    const payload = await req.json();
    const { type, record, old_record } = payload;

    // 1️⃣ 새로운 결재가 상신되었을 때 (INSERT)
    if (type === "INSERT" && record.step_order === 1) {
      // 1차 결재자에게 알림 전송
      await sendPushNotification({
        userId: record.approver_id,
        title: "새로운 결재 요청 📩",
        body: "새로운 기안이 등록되었습니다. 결재함을 확인해 주세요.",
        url: "/admin/approvals",
      });
      return NextResponse.json({ success: true, message: "1차 결재자 알림 전송 완료" });
    }

    // 2️⃣ 누군가 결재를 승인했을 때 (UPDATE)
    if (type === "UPDATE" && old_record?.status === "pending" && record.status === "approved") {
      
      // 다음 순번(step_order)의 결재자가 있는지 DB에서 찾기
      const { data: nextApprover } = await supabaseAdmin
        .from("approval_lines")
        .select("approver_id")
        .eq("leave_request_id", record.leave_request_id)
        .eq("step_order", record.step_order + 1)
        .maybeSingle();

      if (nextApprover) {
        // 👉 다음 결재자가 있다면 그 사람에게 알림
        await sendPushNotification({
          userId: nextApprover.approver_id,
          title: "결재 요청 도착 📩",
          body: "앞선 결재자가 승인했습니다. 다음 결재를 진행해 주세요.",
          url: "/admin/approvals",
        });
        return NextResponse.json({ success: true, message: "다음 결재자 알림 전송 완료" });
        
      } else {
        // 👉 다음 결재자가 없다면? (최종 승인 완료) -> 기안자 본인에게 알림
        // 기안자 ID를 찾기 위해 leave_requests 테이블 조회
        const { data: leaveRequest } = await supabaseAdmin
          .from("leave_requests")
          .select("user_id")
          .eq("id", record.leave_request_id)
          .single();

        if (leaveRequest) {
          await sendPushNotification({
            userId: leaveRequest.user_id,
            title: "결재 최종 승인 완료 🎉",
            body: "신청하신 연차가 최종 승인되었습니다!",
            url: "/",
          });
        }
        return NextResponse.json({ success: true, message: "최종 승인 알림 전송 완료" });
      }
    }

    // 반려(rejected) 처리 등 다른 상태 변화도 여기서 추가 가능합니다.
    if (type === "UPDATE" && record.status === "rejected") {
        const { data: leaveRequest } = await supabaseAdmin
          .from("leave_requests")
          .select("user_id")
          .eq("id", record.leave_request_id)
          .single();

        if (leaveRequest) {
          await sendPushNotification({
            userId: leaveRequest.user_id,
            title: "결재 반려 ❌",
            body: "신청하신 기안이 반려되었습니다. 사유를 확인해 주세요.",
            url: "/",
          });
        }
    }

    return NextResponse.json({ success: true, message: "처리할 이벤트가 아님" });

  } catch (error) {
    console.error("웹훅 처리 중 에러:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
