import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import EmployeeDetailClient from "./EmployeeDetailClient"; // ⭐️ 새로 만든 컴포넌트 import

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  
  const { userId } = await params;

  // 1. 병렬로 데이터 조회 (기존 로직 유지)
  const [profileRes, leaveRes, overtimeRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    
    supabase
      .from("leave_requests")
      .select(`
        *,
        overtime_requests ( title )
      `)
      .eq("user_id", userId)
      .order("start_date", { ascending: false }),

    supabase
      .from("overtime_requests")
      .select("*")
      .eq("user_id", userId)
      .order("work_date", { ascending: false })
  ]);

  if (profileRes.error || !profileRes.data) {
    return notFound();
  }

  const profile = profileRes.data;
  const leaves = leaveRes.data || [];
  const overtimes = overtimeRes.data || [];

  // 2. Client Component로 데이터 전달 및 렌더링
  return (
    <EmployeeDetailClient 
      profile={profile}
      leaves={leaves}
      overtimes={overtimes}
    />
  );
}
