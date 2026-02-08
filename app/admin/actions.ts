"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. 직원 목록 조회
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
  
  const { data } = await supabase
    .from("profiles")
    .select(`
      *,
      annual_leave_allocations (
        id,
        year,
        total_days
      )
    `)
    .order("name");
    
  return data;
}

// 2. 직원 정보 수정
export async function updateEmployee(userId: string, formData: any) {
  const supabase = await createClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();

  if (!adminUser) return { error: "로그인이 필요합니다." };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminUser.id)
    .single();

  if (adminProfile?.role !== 'manager') return { error: "관리자 권한이 없습니다." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      name: formData.name,
      department: formData.department,
      position: formData.position,
      role: formData.role,
      resigned_at: formData.resigned_at || null, 
    })
    .eq("id", userId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/admin");
  return { success: true };
}

// 3. 연차 할당 내역 조회
export async function getEmployeeAllocations(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("annual_leave_allocations")
    .select("*")
    .eq("user_id", userId)
    .order("year", { ascending: false });

  if (error) return [];
  return data;
}

// 4. 연차 할당 저장
export async function saveEmployeeAllocation(userId: string, year: number, days: number) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("annual_leave_allocations")
    .upsert(
      { user_id: userId, year: year, total_days: days },
      { onConflict: "user_id, year" }
    );

  if (error) return { success: false, error: error.message };

  const currentYear = new Date().getFullYear();
  if (year === currentYear) {
    await supabase
      .from("profiles")
      .update({ total_leave_days: days })
      .eq("id", userId);
  }

  revalidatePath("/admin");
  return { success: true };
}

// 5. 연차 할당 삭제
export async function deleteEmployeeAllocation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("annual_leave_allocations")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  
  revalidatePath("/admin");
  return { success: true };
}

// 6. 공휴일 조회
export async function getHolidays() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_holidays").select("*").order("date", { ascending: true });
  if (error) return [];
  return data;
}

// 7. 공휴일 추가
export async function addHoliday(date: string, title: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("public_holidays").insert([{ date, title }]);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

// 8. 공휴일 삭제
export async function deleteHoliday(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("public_holidays").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

// ⭐️ [이 부분이 없어서 에러가 났습니다. 꼭 포함되어야 합니다!]
export async function resetAllUsedLeaveDays() {
  const supabase = await createClient();

  // 1. 관리자 권한 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== 'manager') return { error: "관리자 권한이 없습니다." };

  // 2. 전체 프로필 업데이트 (더미 ID 제외하고 모두)
  const { error } = await supabase
    .from("profiles")
    .update({ used_leave_days: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    console.error("초기화 실패:", error);
    return { error: error.message };
  }

  // 3. 데이터 갱신
  revalidatePath("/admin");
  revalidatePath("/schedule");
  
  return { success: true };
}
