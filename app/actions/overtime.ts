"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ----------------------------------------------------------------------
// [1] 초과근무 신청
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
  // 프론트엔드 hidden input에서 넘어온 값들 (없으면 0 처리)
  const recognizedHours = parseFloat((formData.get("recognizedHours") as string) || "0");
  const recognizedDays = parseFloat((formData.get("recognizedDays") as string) || "0");
  
  // ⭐️ [수정됨] 프론트엔드에서 hidden input value="true"로 보내므로 "true"와 비교해야 함
  const isHoliday = formData.get("isHoliday") === "true"; 

  const planDetails = JSON.parse(formData.get("planDetailsJson") as string);
  const approvers = JSON.parse(formData.get("approversJson") as string);

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
        
        // [NEW] 보상 관련 컬럼 저장
        recognized_hours: recognizedHours,
        recognized_days: recognizedDays,
        is_holiday: isHoliday, // 이제 true/false가 올바르게 들어갑니다.

        location,
        reason,
        plan_details: planDetails,
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
