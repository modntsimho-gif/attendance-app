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

  // ⭐️ 1.5 실시간 연차/보상휴가 계산 로직 (기본 연차 vs 누적 보상휴가 분리)
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  // 💡 불필요한 대체휴무 쿼리(extraLeavesRes)를 제거하고 성능을 최적화했습니다.
  const [allocRes, annualLeavesRes, overtimesRes] = await Promise.all([
    // ① 올해 부여된 총 연차 (연도 제한 O)
    supabase
      .from("annual_leave_allocations")
      .select("total_days")
      .eq("user_id", user.id)
      .eq("year", currentYear)
      .maybeSingle(),
      
    // ② 올해 사용한 '기본 연차' (연도 제한 O)
    supabase
      .from("leave_requests")
      .select("total_leave_days")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .neq("request_type", "cancel")
      .in("leave_type", ['연차', 'annual', '반차', '반반차'])
      .gte("start_date", yearStart)
      .lte("start_date", yearEnd),
      
    // ③ 누적 발생 및 사용한 '초과근무' (연도 제한 X - 전체 기간 합산)
    // ⭐️ used_hours 필드를 추가로 불러옵니다.
    supabase
      .from("overtime_requests")
      .select("recognized_days, recognized_hours, used_hours")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .neq("request_type", "cancel")
  ]);

  // 📊 실시간 합산 계산
  const calculatedTotalLeave = allocRes.data ? allocRes.data.total_days : (profile?.total_leave_days || 0);
  
  const calculatedUsedLeave = (annualLeavesRes.data || [])
    .reduce((sum, l) => sum + Number(l.total_leave_days || 0), 0);

  // 🟢 총 발생 보상휴가 계산
  const calculatedExtraTotal = (overtimesRes.data || [])
    .reduce((sum, o) => sum + Number(o.recognized_days || (o.recognized_hours ? o.recognized_hours / 8 : 0)), 0);

  // 🟢 총 사용 보상휴가 계산 (⭐️ 수정됨: overtimes의 used_hours를 8로 나누어 합산)
  const calculatedExtraUsed = (overtimesRes.data || [])
    .reduce((sum, o) => sum + Number(o.used_hours ? o.used_hours / 8 : 0), 0);

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
      isApprover={profile?.is_approver || profile?.department === "외주" || false} 
      
      // ⭐️ [수정됨] 실시간으로 계산된 완벽한 데이터 전달
      totalLeave={calculatedTotalLeave}
      usedLeave={calculatedUsedLeave}
      extraTotalLeave={calculatedExtraTotal}
      extraUsedLeave={calculatedExtraUsed}

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
