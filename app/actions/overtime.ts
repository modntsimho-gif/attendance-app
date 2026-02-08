"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ----------------------------------------------------------------------
// [1] 초과근무 신청 (수정됨)
// ----------------------------------------------------------------------
export async function submitOvertimeRequest(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 1. 기본 데이터 추출
  const title = formData.get("title") as string;
  const workDate = formData.get("workDate") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const totalHours = formData.get("totalHours") as string;
  const location = formData.get("location") as string;
  const reason = formData.get("reason") as string;

  // 2. [NEW] 인정 휴가(보상) 데이터 추출
  const recognizedHours = parseFloat((formData.get("recognizedHours") as string) || "0");
  const recognizedDays = parseFloat((formData.get("recognizedDays") as string) || "0");
  const isHoliday = formData.get("isHoliday") === "true"; 

  // 3. [NEW] 신청 유형 및 원본 ID 추출 (⭐️ 여기가 핵심입니다!)
  const requestType = formData.get("requestType")?.toString() || "create";
  
  const rawOriginalId = formData.get("originalOvertimeId")?.toString();
  const originalOvertimeId = (rawOriginalId && rawOriginalId.trim() !== "") ? rawOriginalId : null;

  // 4. JSON 데이터 파싱
  const planDetails = JSON.parse(formData.get("planDetailsJson") as string);
  const approvers = JSON.parse(formData.get("approversJson") as string);

  // 5. [방어 로직] 변경/취소인데 원본 ID가 없으면 에러
  if ((requestType === 'update' || requestType === 'cancel') && !originalOvertimeId) {
    return { error: "변경 또는 취소 신청 시 원본 내역 정보가 누락되었습니다." };
  }

  try {
    const { data: requestData, error: requestError } = await supabase
      .from("overtime_requests")
      .insert({
        user_id: user.id,
        title,
        work_date: workDate,
        start_time: startTime,
        end_time: endTime,
        total_hours: parseFloat(totalHours),
        
        recognized_hours: recognizedHours,
        recognized_days: recognizedDays,
        is_holiday: isHoliday,

        location,
        reason,
        plan_details: planDetails,
        
        // ⭐️ [중요] DB에 request_type과 원본 ID를 저장합니다.
        request_type: requestType,
        original_overtime_request_id: originalOvertimeId,

        status: "pending",
      })
      .select("id")
      .single();

    if (requestError) throw new Error(requestError.message);

    const requestId = requestData.id;

    const approvalInserts = approvers.map((approver: any, index: number) => ({
      overtime_request_id: requestId,
      approver_id: approver.id,
      step_order: index + 1,
      status: "pending",
    }));

    const { error: approvalError } = await supabase
      .from("approval_lines")
      .insert(approvalInserts);

    if (approvalError) throw new Error("결재선 저장 실패: " + approvalError.message);

    revalidatePath("/"); 
    return { success: true };

  } catch (error: any) {
    console.error("DB Error:", error);
    return { error: error.message };
  }
}
// ----------------------------------------------------------------------
// [2] 초과근무 신청 삭제
// ----------------------------------------------------------------------
export async function deleteOvertimeRequest(requestId: string) {
  const supabase = await createClient();

  try {
    // 1. 상태 확인
    const { data: request, error: fetchError } = await supabase
      .from("overtime_requests")
      .select("status")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) return { error: "문서를 찾을 수 없습니다." };
    if (request.status !== "pending") {
      return { error: "결재가 진행 중이거나 완료된 문서는 삭제할 수 없습니다." };
    }

    // 2. 연결된 결재선(approval_lines) 삭제
    const { error: lineError } = await supabase
      .from("approval_lines")
      .delete()
      .eq("overtime_request_id", requestId);

    if (lineError) {
      console.error("결재선 삭제 중 에러(무시 가능):", lineError);
    }

    // 3. 본문(신청서) 삭제
    const { error: deleteError } = await supabase
      .from("overtime_requests")
      .delete()
      .eq("id", requestId);

    if (deleteError) {
      console.error("본문 삭제 에러:", deleteError);
      return { error: "삭제 권한이 없거나 DB 오류입니다." };
    }

    revalidatePath("/"); 
    return { success: true };

  } catch (error: any) {
    console.error("Server Error:", error);
    return { error: "서버 오류: " + error.message };
  }
}
