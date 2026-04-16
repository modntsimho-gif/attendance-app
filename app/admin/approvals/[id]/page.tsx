import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import ApproverHistoryClient from "./ApproverHistoryClient"; // ⭐️ 클라이언트 컴포넌트 임포트

export const dynamic = "force-dynamic";

export default async function ApproverHistoryPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const supabase = await createClient();
  
  const resolvedParams = await params;
  const approverId = resolvedParams.id;

  const [approverRes, linesRes, sortRes] = await Promise.all([
    supabase.from("profiles").select("name, department, position").eq("id", approverId).single(),
    supabase.from("approval_lines").select(`
        id, status, decided_at, comment,
        leave_requests ( 
          id, created_at, leave_type, start_date, end_date, start_time, end_time, reason, handover_notes, 
          request_type, original_leave_request_id, overtime_request_ids, 
          status, total_days, deducted_hours, 
          profiles (id, name, department, position, avatar_url) 
        ),
        overtime_requests ( 
          id, created_at, work_date, start_time, end_time, reason, location, total_hours, 
          request_type, original_overtime_request_id, 
          title, is_holiday, plan_details, status,
          profiles (id, name, department, position, avatar_url) 
        )
      `).eq("approver_id", approverId).in("status", ["approved", "rejected","pending"]).order("decided_at", { ascending: false }),
    supabase.from("sort_settings").select("*")
  ]);

  // ⭐️ 이 줄을 추가해서 터미널(서버 콘솔)을 확인해 보세요!
  if (linesRes.error) {
    console.error("🚨 쿼리 에러 발생:", linesRes.error);
  }
  const approver = approverRes.data;
  const lines = linesRes.data || [];
  const sortSettings = sortRes.data || [];

  if (!approver) return redirect("/admin/approvals");

  const deptSortMap = new Map<string, number>();
  const empSortMap = new Map<string, number>();
  
  sortSettings.forEach(s => {
    if (s.target_type === 'department') deptSortMap.set(s.target_id, s.sort_order);
    if (s.target_type === 'employee') empSortMap.set(s.target_id, s.sort_order);
  });

  type GroupedData = Record<string, Record<string, { requester: any; lines: any[] }>>;
  const grouped: GroupedData = {};

  lines.forEach((line: any) => {
    const isLeave = !!line.leave_requests;
    const req = isLeave ? line.leave_requests : line.overtime_requests;
    if (!req || !req.profiles) return; 

    const requester = req.profiles;
    const dept = requester.department || '소속 없음';
    const empId = requester.id;

    if (!grouped[dept]) grouped[dept] = {};
    if (!grouped[dept][empId]) grouped[dept][empId] = { requester, lines: [] };

    grouped[dept][empId].lines.push({ ...line, isLeave, req });
  });

  const sortedDepts = Object.keys(grouped).sort((a, b) => {
    const orderA = deptSortMap.get(a) ?? 99;
    const orderB = deptSortMap.get(b) ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* 상단 헤더 영역 */}
        <div className="flex items-center justify-between bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <Link href="/admin/approvals" className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                {approver.name} {approver.position || ''} 결재 내역
              </h1>
              <p className="text-sm text-gray-500 mt-1">{approver.department || '소속 없음'} 소속 결재권자가 처리한 내역을 부서/직원별로 확인합니다.</p>
            </div>
          </div>
          <div className="hidden sm:block text-sm font-medium text-gray-500 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
            총 처리 건수 <span className="text-blue-600 font-bold">{lines.length}</span>건
          </div>
        </div>

        {/* ⭐️ 클라이언트 컴포넌트 호출 */}
        <ApproverHistoryClient 
          sortedDepts={sortedDepts} 
          grouped={grouped} 
          empSortMap={empSortMap} 
        />

      </div>
    </main>
  );
}
