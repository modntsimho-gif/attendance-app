import { createClient } from "@/utils/supabase/server";
import ScheduleClient from "@/app/schedule/ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const supabase = await createClient();

  // 1. 병렬로 필요한 모든 데이터 조회
  const [profilesRes, allocationsRes, leavesRes, overtimesRes] = await Promise.all([
    // (1) 일반 직원(employee) 목록
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "employee")
      .order("name", { ascending: true }),

    // (2) 연도별 연차 할당 정보 (모든 직원)
    supabase
      .from("annual_leave_allocations")
      .select("*"),

    // (3) 휴가 사용 내역 (승인된 것만, 취소 제외)
    supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "approved"),

    // (4) 초과근무 내역 (승인된 것만, 보상휴가 발생 계산용)
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
