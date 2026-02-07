"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitLeaveRequest(formData: FormData) {
  const supabase = await createClient();

  // 1. 유저 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 2. 결재선 데이터 파싱
  const approversJson = formData.get("approversJson") as string;
  const approvers = approversJson ? JSON.parse(approversJson) : [];

  // 3. 데이터 추출
  const leaveType = formData.get("leaveType") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const totalLeaveDays = parseFloat(formData.get("totalLeaveDays") as string || "0");

  // [수정] 초과근무 ID 처리 (빈 문자열이면 null로 변환하여 UUID 에러 방지)
  const rawOtId = formData.get("overtimeRequestId")?.toString();
  const overtimeRequestId = (rawOtId && rawOtId.trim() !== "") ? rawOtId : null;
  
  const deductedHours = totalLeaveDays * 8; 

  // 4. 필수값 체크
  if (!leaveType || !startDate || !endDate) {
    return { error: "필수 항목(휴가 종류, 기간)을 입력해주세요." };
  }

  // [추가] 대체휴무인데 원천 ID가 없으면 에러
  if (leaveType.startsWith("대체휴무") && !overtimeRequestId) {
    return { error: "대체휴무 사용 시 보상 휴가 원천을 선택해야 합니다." };
  }

  // 5. DB 저장용 객체 생성
  const leaveDataPayload = {
    user_id: user.id,
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    start_time: formData.get("startTime") as string || null,
    end_time: formData.get("endTime") as string || null,
    reason: formData.get("reason") as string,
    handover_notes: formData.get("handoverNotes") as string,
    
    total_leave_days: totalLeaveDays,
    deducted_hours: deductedHours,
    overtime_request_id: overtimeRequestId, // null 또는 UUID

    replacement_date_1: formData.get("repDate1") as string || null,
    replacement_time_1_start: formData.get("repTime1Start") as string || null,
    replacement_time_1_end: formData.get("repTime1End") as string || null,
    replacement_date_2: formData.get("repDate2") as string || null,
    replacement_time_2_start: formData.get("repTime2Start") as string || null,
    replacement_time_2_end: formData.get("repTime2End") as string || null,
    
    status: "pending"
  };

  try {
    // 6. 휴가 신청서 저장
    const { data: savedRequest, error: leaveError } = await supabase
      .from("leave_requests")
      .insert(leaveDataPayload)
      .select("id") 
      .single();

    if (leaveError) throw new Error(leaveError.message);

    const requestId = savedRequest.id;

    // 7. 결재선 저장
    if (approvers.length > 0) {
      const approvalInserts = approvers.map((approver: any, index: number) => ({
        leave_request_id: requestId,      
        approver_id: approver.id,         
        step_order: index + 1,            
        status: "pending",
      }));

      const { error: approvalError } = await supabase
        .from("approval_lines")
        .insert(approvalInserts);

      if (approvalError) throw new Error("결재선 저장 실패: " + approvalError.message);
    }

    // 8. 성공 처리
    revalidatePath("/"); 
    return { success: true };

  } catch (error: any) {
    console.error("DB Error:", error);
    return { error: "신청 처리 중 오류가 발생했습니다: " + error.message };
  }
}
