import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserCheck, Building2, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ApproverListPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: myProfile } = await supabase.from("profiles").select("role, is_approver").eq("id", user.id).single();
  if (myProfile?.role !== 'manager' && !myProfile?.is_approver) return redirect("/");

  // 1. 결재권자 목록 조회
  const { data: approvers } = await supabase
    .from("profiles")
    .select("id, name, department, position, avatar_url")
    .eq("is_approver", true);

  // 2. 정렬 설정(sort_settings) 조회
  const { data: sortSettings } = await supabase.from("sort_settings").select("*");

  // 정렬 맵 생성
  const deptSortMap = new Map<string, number>();
  const empSortMap = new Map<string, number>();
  
  sortSettings?.forEach(s => {
    if (s.target_type === 'department') deptSortMap.set(s.target_id, s.sort_order);
    if (s.target_type === 'employee') empSortMap.set(s.target_id, s.sort_order);
  });

  // 3. 부서별 그룹화 및 정렬
  const grouped: Record<string, any[]> = {};
  approvers?.forEach(a => {
    const dept = a.department || '소속없음';
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(a);
  });

  // 직원 정렬 (sort_order -> 이름순)
  Object.keys(grouped).forEach(dept => {
    grouped[dept].sort((a, b) => {
      const orderA = empSortMap.get(a.id) ?? 99;
      const orderB = empSortMap.get(b.id) ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  });

  // 부서 정렬 (sort_order -> 부서명순)
  const sortedDepts = Object.keys(grouped).sort((a, b) => {
    const orderA = deptSortMap.get(a) ?? 99;
    const orderB = deptSortMap.get(b) ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* 헤더 */}
        <div className="flex items-center justify-between bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><UserCheck className="w-6 h-6 text-blue-600" /> 결재권자별 결재 내역</h1>
              <p className="text-sm text-gray-500 mt-1">조회할 결재권자를 선택하면 해당 임직원이 처리한 결재 이력을 확인할 수 있습니다.</p>
            </div>
          </div>
        </div>

        {/* 부서별 섹션 렌더링 */}
        {sortedDepts.length > 0 ? (
          sortedDepts.map(dept => (
            <div key={dept} className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b border-gray-200 pb-2">
                <Building2 className="w-5 h-5 text-gray-400" /> {dept}
                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{grouped[dept].length}명</span>
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[dept].map((approver) => (
                  <Link key={approver.id} href={`/admin/approvals/${approver.id}`} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all group flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                        {approver.avatar_url ? <img src={approver.avatar_url} alt={approver.name} className="w-full h-full object-cover" /> : <span className="text-blue-600 font-bold text-lg">{approver.name.substring(0, 1)}</span>}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-lg flex items-center gap-2">
                          {approver.name} <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{approver.position || "직급없음"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <p className="text-gray-500 text-sm">등록된 결재권자가 없습니다.</p>
          </div>
        )}
      </div>
    </main>
  );
}
