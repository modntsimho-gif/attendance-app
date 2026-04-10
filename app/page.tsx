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

  // 4. [관리자] 내가 결재해야 할 문서 건수 (pending 상태) - ⭐️ 내 차례인 것만 카운트
  const { data: myPendingLines } = await supabase
    .from("approval_lines")
    .select("*")
    .eq("approver_id", user.id)
    .eq("status", "pending");

  let realPendingCount = 0;

  if (myPendingLines && myPendingLines.length > 0) {
    const leaveIds = myPendingLines.map(l => l.leave_request_id).filter(Boolean);
    const overtimeIds = myPendingLines.map(l => l.overtime_request_id).filter(Boolean);

    // 관련된 모든 결재선 데이터 가져오기
    const [leaveLinesRes, overtimeLinesRes] = await Promise.all([
      leaveIds.length > 0 ? supabase.from("approval_lines").select("*").in("leave_request_id", leaveIds) : Promise.resolve({ data: [] }),
      overtimeIds.length > 0 ? supabase.from("approval_lines").select("*").in("overtime_request_id", overtimeIds) : Promise.resolve({ data: [] })
    ]);

    const allLines = [...(leaveLinesRes.data || []), ...(overtimeLinesRes.data || [])];

    // 내 차례인 문서만 카운트
    myPendingLines.forEach(myLine => {
      const reqId = myLine.leave_request_id || myLine.overtime_request_id;
      
      // 해당 문서의 결재선을 step_order 순으로 정렬
      const linesForThisReq = allLines
        .filter(l => l.leave_request_id === reqId || l.overtime_request_id === reqId)
        .sort((a, b) => a.step_order - b.step_order);
        
      // 첫 번째 대기자가 '나'인지 확인
      const currentPending = linesForThisReq.find(l => l.status === "pending");
      if (currentPending && currentPending.approver_id === user.id) {
        realPendingCount++;
      }
    });
  }

  // 5. 전체 직원 리스트 조회 (위젯용)
  const { data: employees } = await supabase
    .from("profiles")
    .select("id, name, department, position, avatar_url")
    .neq("department", "외주")
    .order("name", { ascending: true });

  return (
    <DashboardClient 
      userName={profile?.name || "사용자"}
      department={profile?.department || "부서 미정"}
      
      // 권한 정보
      role={profile?.role} 
      // ⭐️ [수정] 부서가 "외주"일 경우에도 결재권자 권한 부여
      isApprover={profile?.is_approver || profile?.department === "외주" || false} 
      
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
      pendingApprovalCount={realPendingCount}

      // 직원 리스트 전달
      employees={employees || []}
    />
  );
}
