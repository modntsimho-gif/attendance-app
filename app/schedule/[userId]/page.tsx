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
  const [profileRes, leaveRes, overtimeRes] = await Promise.all([
    // (1) 프로필 조회
    supabase.from("profiles").select("*").eq("id", userId).single(),
    
    // (2) 휴가 신청 내역 조회 (결재선 -> 프로필 이름 조인 추가)
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

    // (3) 초과근무 내역 조회 (결재선 -> 프로필 이름 조인 추가)
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
      .order("work_date", { ascending: false })
  ]);

  if (profileRes.error || !profileRes.data) {
    return notFound();
  }

  // ⭐️ 데이터 가공 함수: 결재선에서 승인/반려한 사람의 이름을 추출
  const processApprover = (items: any[]) => {
    if (!items) return [];
    
    return items.map((item) => {
      // approval_lines 배열 중에서 승인(approved) 또는 반려(rejected) 상태인 항목 찾기
      const deciderLine = item.approval_lines?.find(
        (line: any) => line.status === 'approved' || line.status === 'rejected'
      );

      // profiles가 조인되어 있으므로 이름 추출
      // (Supabase 조인 결과는 객체일 수도, 배열일 수도 있어 안전하게 처리)
      const approverProfile = Array.isArray(deciderLine?.profiles) 
        ? deciderLine?.profiles[0] 
        : deciderLine?.profiles;

      return {
        ...item,
        approver_name: approverProfile?.name || null, // approver_name 필드 추가
      };
    });
  };

  const profile = profileRes.data;
  // 가공 함수를 통과시켜 approver_name을 포함시킴
  const leaves = processApprover(leaveRes.data || []);
  const overtimes = processApprover(overtimeRes.data || []);

  // 2. Client Component로 데이터 전달 및 렌더링
  return (
    <EmployeeDetailClient 
      profile={profile}
      leaves={leaves}
      overtimes={overtimes}
    />
  );
}
