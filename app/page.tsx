import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 0. 로그인 체크
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // 1. 프로필 정보 가져오기
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // 2. [본인] 연차 신청 건수 (대기중)
  const { count: leaveRequestCount } = await supabase
    .from("leave_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");

  // 3. [본인] 초과근무 신청 건수 (대기중)
  const { count: overtimeRequestCount } = await supabase
    .from("overtime_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");

  // 4. [관리자] 내가 결재해야 할 문서 건수 (pending 상태)
  const { count: pendingApprovalCount } = await supabase
    .from("approval_lines")
    .select("*", { count: "exact", head: true })
    .eq("approver_id", user.id)
    .eq("status", "pending");

  // ⭐️ [NEW] 5. 전체 직원 리스트 조회 (위젯용)
  // role이 'employee'인 직원들만 가져옵니다. (필요시 .eq 부분 제거하면 관리자도 포함됨)
  const { data: employees } = await supabase
    .from("profiles")
    .select("id, name, department, position, avatar_url")
    .eq("role", "employee") 
    .order("name", { ascending: true });

  return (
    <DashboardClient 
      userName={profile?.name || "사용자"}
      department={profile?.department || "부서 미정"}
      
      // 권한 정보
      role={profile?.role} 
      
      // 기본 연차
      totalLeave={profile?.total_leave_days || 0}
      usedLeave={profile?.used_leave_days || 0}
      
      // 보상 휴가 (DB 값 그대로 사용)
      extraTotalLeave={profile?.extra_leave_days || 0}
      extraUsedLeave={profile?.extra_used_leave_days || 0}

      // 카운트 (본인 신청 내역)
      leaveRequestCount={leaveRequestCount || 0}
      overtimeRequestCount={overtimeRequestCount || 0}

      // 결재 대기 건수 (관리자용)
      pendingApprovalCount={pendingApprovalCount || 0}

      // ⭐️ [NEW] 직원 리스트 전달
      employees={employees || []}
    />
  );
}
