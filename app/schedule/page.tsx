import { createClient } from "@/utils/supabase/server";
import ScheduleClient from "@/app/schedule/ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const supabase = await createClient();

  // 1. 병렬로 필요한 모든 데이터 조회
  const [profilesRes, allocationsRes, leavesRes, overtimesRes] = await Promise.all([
    // (1) 일반 직원(employee) 목록 - ⭐️ 퇴사자 제외 추가
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "employee")
      .is("resigned_at", null) // ⭐️ 퇴사일이 없는(null) 사람만 조회
      .order("name", { ascending: true }),

    // (2) 연도별 연차 할당 정보
    supabase
      .from("annual_leave_allocations")
      .select("*"),

    // (3) 휴가 사용 내역 (승인된 것만)
    supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "approved"),

    // (4) 초과근무 내역 (승인된 것만)
    supabase
      .from("overtime_requests")
      .select("*")
      .eq("status", "approved")
  ]);

  const employees = profilesRes.data || [];
  const allocations = allocationsRes.data || [];
  const leaves = leavesRes.data || [];
  const overtimes = overtimesRes.data || [];

  // 2. Client Component로 데이터 전달
  return (
    <ScheduleClient 
      employees={employees}
      allocations={allocations}
      leaves={leaves}
      overtimes={overtimes}
    />
  );
}
