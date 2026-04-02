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
    .neq("department", "외주");

  if (!data) return [];

  // ⭐️ 1. 직급 순서 정의 (위에서 아래로 노출하고 싶은 순서대로 작성)
  const positionOrder = ["사무총장", "팀장", "차장", "과장", "대리", "간사"];

  // ⭐️ 2. 직급 -> 이름 순으로 정렬 (JS 단에서 처리)
  const sortedData = data.sort((a, b) => {
    const posA = a.position || "";
    const posB = b.position || "";
    
    const indexA = positionOrder.indexOf(posA);
    const indexB = positionOrder.indexOf(posB);

    // 둘 다 정의된 직급이 있는 경우 직급 순서 비교
    if (indexA !== -1 && indexB !== -1) {
      if (indexA !== indexB) return indexA - indexB; 
    } 
    // 한 쪽만 직급이 없는 경우 (직급 없는 사람을 맨 뒤로 보냄)
    else if (indexA !== -1) return -1;
    else if (indexB !== -1) return 1;

    // 직급이 같거나 둘 다 직급이 없는 경우 -> 이름 가나다순 정렬
    const nameA = a.name || "";
    const nameB = b.name || "";
    return nameA.localeCompare(nameB);
  });
    
  return sortedData;
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
      is_approver: formData.is_approver, // ⭐️ 결재 권한 저장 추가
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

// 9. 전직원 연차 사용일 초기화
export async function resetAllUsedLeaveDays() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .neq("position","외주")
    .single();

  if (adminProfile?.role !== 'manager') return { error: "관리자 권한이 없습니다." };

  // ⭐️ 총 연차와 사용 연차 모두 0으로 초기화
  const { error } = await supabase
    .from("profiles")
    .update({ 
      total_leave_days: 0,
      used_leave_days: 0 
    })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    console.error("초기화 실패:", error);
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/schedule");
  
  return { success: true };
}

// 10. 엑셀 일괄 업로드 (연차 할당 + 올해 연차 프로필 동기화)
export async function bulkUpsertAllocations(
  allocations: { user_id: string; year: number; total_days: number }[]
) {
  const supabase = await createClient();

  // 1. 관리자 권한 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "로그인이 필요합니다." };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== 'manager') return { success: false, error: "관리자 권한이 없습니다." };

  try {
    // 2. annual_leave_allocations 테이블에 일괄 덮어쓰기
    const { error: upsertError } = await supabase
      .from("annual_leave_allocations")
      .upsert(allocations, { onConflict: "user_id, year" });

    if (upsertError) throw upsertError;

    // 3. 현재 연도(올해) 데이터만 필터링하여 profiles 테이블 업데이트
    const currentYear = new Date().getFullYear();
    const currentYearAllocations = allocations.filter(a => a.year === currentYear);

    if (currentYearAllocations.length > 0) {
      await Promise.all(
        currentYearAllocations.map(alloc => 
          supabase
            .from("profiles")
            .update({ total_leave_days: alloc.total_days })
            .eq("id", alloc.user_id)
        )
      );
    }

    // 4. 데이터 갱신
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("엑셀 일괄 업로드 에러:", error);
    return { success: false, error: error.message };
  }
}

// 12. 정렬 설정 조회
export async function getSortSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sort_settings").select("*");
  if (error) return [];
  return data;
}

// 13. 정렬 설정 일괄 저장 (부서 + 직원)
export async function updateSortSettings(
  sortData: { target_id: string; target_type: string; sort_order: number }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "로그인이 필요합니다." };

  try {
    // target_id를 기준으로 덮어쓰기(upsert)
    const { error } = await supabase
      .from("sort_settings")
      .upsert(sortData, { onConflict: "target_id" });

    if (error) throw error;

    revalidatePath("/admin");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error: any) {
    console.error("정렬 순서 업데이트 에러:", error);
    return { success: false, error: error.message };
  }
}