import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import EmployeeDetailClient from "./EmployeeDetailClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  
  const { userId } = await params;

  // 1. 병렬로 데이터 조회
  const [profileRes, leaveRes, overtimeRes, allocationRes] = await Promise.all([
    // (1) 프로필 조회
    supabase.from("profiles").select("*").eq("id", userId).single(),
    
    // (2) 휴가 신청 내역 조회
    supabase
      .from("leave_requests")
      .select(`
        *,
        overtime_requests ( title ),
        approval_lines (
          status,
          updated_at,
          profiles ( name )
        )
      `)
      .eq("user_id", userId)
      .order("start_date", { ascending: false }),

    // (3) 초과근무 내역 조회
    supabase
      .from("overtime_requests")
      .select(`
        *,
        approval_lines (
          status,
          updated_at,
          profiles ( name )
        )
      `)
      .eq("user_id", userId)
      .order("work_date", { ascending: false }),

    // ⭐️ (4) [NEW] 연도별 연차 할당량 조회
    supabase
      .from("annual_leave_allocations")
      .select("*")
      .eq("user_id", userId)
      .order("year", { ascending: false })
  ]);

  if (profileRes.error || !profileRes.data) {
    return notFound();
  }

  // ⭐️ 데이터 가공 함수: 결재선에서 승인/반려한 사람의 이름을 추출
  const processApprover = (items: any[]) => {
    if (!items) return [];
    
    return items.map((item) => {
      const deciderLine = item.approval_lines?.find(
        (line: any) => line.status === 'approved' || line.status === 'rejected'
      );
      const approverProfile = Array.isArray(deciderLine?.profiles) 
        ? deciderLine?.profiles[0] 
        : deciderLine?.profiles;

      return {
        ...item,
        approver_name: approverProfile?.name || null,
      };
    });
  };

  const profile = profileRes.data;
  const leaves = processApprover(leaveRes.data || []);
  const overtimes = processApprover(overtimeRes.data || []);
  const allocations = allocationRes.data || []; // 연도별 할당 정보

  // 2. Client Component로 데이터 전달
  return (
    <EmployeeDetailClient 
      profile={profile}
      leaves={leaves}
      overtimes={overtimes}
      allocations={allocations} // ⭐️ 전달
    />
  );
}
