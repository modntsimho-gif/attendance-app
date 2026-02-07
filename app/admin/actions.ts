"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 직원 목록 조회 (기존 유지)
export async function getEmployees() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: currentUser } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentUser?.role !== 'manager') throw new Error("접근 권한이 없습니다.");
  
  const { data } = await supabase.from("profiles").select("*").order("name");
  return data;
}

// ⭐️ [수정됨] 연차 외 휴가(보상휴가) 사용 로그 추가
export async function updateEmployee(userId: string, formData: any) {
  const supabase = await createClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();

  if (!adminUser) return { error: "로그인이 필요합니다." };

  // 1. 관리자 권한 체크
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminUser.id)
    .single();

  if (adminProfile?.role !== 'manager') return { error: "관리자 권한이 없습니다." };

  // 2. 변경 전 기존 데이터 가져오기
  const { data: oldProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!oldProfile) return { error: "대상 사용자를 찾을 수 없습니다." };

  // 3. 데이터 정리
  const newTotal = parseFloat(formData.total_leave_days) || 0;
  const newUsed = parseFloat(formData.used_leave_days) || 0;
  const newExtra = parseFloat(formData.extra_leave_days) || 0;
  const newExtraUsed = parseFloat(formData.extra_used_leave_days) || 0;

  // 4. 프로필 업데이트 (실제 점수 반영)
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      name: formData.name,
      department: formData.department,
      position: formData.position,
      role: formData.role,
      total_leave_days: newTotal,
      used_leave_days: newUsed,
      extra_leave_days: newExtra,
      extra_used_leave_days: newExtraUsed,
    })
    .eq("id", userId);

  if (updateError) return { error: updateError.message };

  // ============================================================
  // 5. 로그 기록 (로직 추가됨)
  // ============================================================
  
  const diffUsed = newUsed - (oldProfile.used_leave_days || 0);       // 일반 연차 사용 변화량
  const diffExtra = newExtra - (oldProfile.extra_leave_days || 0);    // 보상 휴가 발생 변화량
  const diffExtraUsed = newExtraUsed - (oldProfile.extra_used_leave_days || 0); // [NEW] 보상 휴가 사용 변화량

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // (A) [일반 연차 사용] 변경 시 -> leave_requests
    if (diffUsed !== 0) {
      const { data: leaveReq, error: leaveErr } = await supabase
        .from("leave_requests")
        .insert({
          user_id: userId,
          leave_type: "관리자 조정", 
          start_date: today,
          end_date: today,
          total_leave_days: diffUsed,
          reason: `[관리자 조정] 일반 연차 사용분 ${diffUsed}일 조정`,
          status: "approved"
        })
        .select()
        .single();

      if (leaveReq) await createAdminApprovalLine(supabase, adminUser.id, leaveReq.id, null);
    }

    // (B) [보상 휴가 발생] 변경 시 -> overtime_requests
    if (diffExtra !== 0) {
      const adjustedHours = (diffExtra * 8) / 1.5;

      const { data: overtimeReq, error: overErr } = await supabase
        .from("overtime_requests")
        .insert({
          user_id: userId,
          title: "[관리자 조정] 보상 휴가 발생분 조정",
          work_date: today,
          start_time: "09:00",
          end_time: "18:00",
          total_hours: Number(adjustedHours.toFixed(1)),
          reason: `[관리자 조정] 발생분 ${diffExtra}일 조정`,
          status: "approved"
        })
        .select()
        .single();

      if (overtimeReq) await createAdminApprovalLine(supabase, adminUser.id, null, overtimeReq.id);
    }

    // (C) ⭐️ [보상 휴가 사용] 변경 시 -> leave_requests (추가된 로직)
    if (diffExtraUsed !== 0) {
      const { data: extraLeaveReq, error: extraLeaveErr } = await supabase
        .from("leave_requests")
        .insert({
          user_id: userId,
          // 구분하기 쉽게 타입을 달리하거나, 사유에 명시합니다.
          leave_type: "관리자 조정", 
          start_date: today,
          end_date: today,
          total_leave_days: diffExtraUsed,
          reason: `[관리자 조정] 보상 휴가(연차 외) 사용분 ${diffExtraUsed}일 조정`,
          status: "approved"
        })
        .select()
        .single();

      if (extraLeaveErr) {
        console.error("보상휴가 사용 조정 실패:", extraLeaveErr);
      } else if (extraLeaveReq) {
        await createAdminApprovalLine(supabase, adminUser.id, extraLeaveReq.id, null);
      }
    }

  } catch (logError) {
    console.error("로그 로직 전체 에러:", logError);
  }

  revalidatePath("/admin");
  return { success: true };
}

// (헬퍼 함수) 관리자 승인 라인 생성 중복 제거
async function createAdminApprovalLine(supabase: any, adminId: string, leaveId: string | null, overtimeId: string | null) {
  await supabase.from("approval_lines").insert({
    approver_id: adminId,
    leave_request_id: leaveId,
    overtime_request_id: overtimeId,
    step_order: 1,
    status: "approved",
    comment: "관리자 페이지 강제 조정",
    decided_at: new Date().toISOString()
  });
}


// 1. 공휴일 목록 가져오기
export async function getHolidays() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_holidays")
    .select("*")
    .order("date", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

// 2. 공휴일 추가하기
export async function addHoliday(date: string, title: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("public_holidays")
    .insert([{ date, title }]);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

// 3. 공휴일 삭제하기
export async function deleteHoliday(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("public_holidays")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}