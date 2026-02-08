import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { ArrowLeft, Users, Calendar, PieChart, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic"; // 항상 최신 데이터 조회

export default async function SchedulePage() {
  const supabase = await createClient();

  // 1. role이 'employee'인 직원 목록 조회
  const { data: employees, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "employee")
    .order("name", { ascending: true });

  if (error) {
    return <div className="p-8 text-center text-red-500">데이터를 불러오는 중 오류가 발생했습니다: {error.message}</div>;
  }

  // 2. 계산 및 포맷팅 헬퍼 함수
  const calculateStats = (total: number, used: number) => {
    const remaining = total - used;
    const rate = total > 0 ? (used / total) * 100 : 0;
    return {
      remaining: Number(remaining.toFixed(2)), // 소수점 2자리 정리
      rate: Math.min(100, Math.max(0, rate)).toFixed(1), // 0~100 사이 제한
    };
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-2 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> 대시보드로 돌아가기
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              전체 직원 근태 현황
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              모든 일반 직원(Employee)의 연차 및 보상 휴가 사용 내역을 조회합니다.
            </p>
          </div>
        </div>

        {/* 데이터 테이블 카드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-bold min-w-[150px] sticky left-0 bg-gray-50 z-10">직원 정보</th>
                  
                  {/* 연차 섹션 헤더 */}
                  <th colSpan={4} className="px-6 py-4 text-center border-l border-gray-200 bg-blue-50/50 text-blue-800">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="w-4 h-4" /> 기본 연차
                    </div>
                  </th>
                  
                  {/* 보상휴가 섹션 헤더 */}
                  <th colSpan={4} className="px-6 py-4 text-center border-l border-gray-200 bg-orange-50/50 text-orange-800">
                    <div className="flex items-center justify-center gap-1">
                      <PieChart className="w-4 h-4" /> 연차 외 휴가 (보상)
                    </div>
                  </th>
                </tr>
                <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3 sticky left-0 bg-gray-50 z-10">이름 / 부서</th>
                  
                  {/* 연차 컬럼 */}
                  <th className="px-4 py-3 text-right border-l border-gray-100 bg-blue-50/30">총 연차</th>
                  <th className="px-4 py-3 text-right bg-blue-50/30">사용</th>
                  <th className="px-4 py-3 text-right bg-blue-50/30 font-bold text-gray-700">잔여</th>
                  <th className="px-4 py-3 text-center bg-blue-50/30">사용률</th>

                  {/* 보상휴가 컬럼 */}
                  <th className="px-4 py-3 text-right border-l border-gray-100 bg-orange-50/30">총 발생</th>
                  <th className="px-4 py-3 text-right bg-orange-50/30">사용</th>
                  <th className="px-4 py-3 text-right bg-orange-50/30 font-bold text-gray-700">잔여</th>
                  <th className="px-4 py-3 text-center bg-orange-50/30">사용률</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-gray-100">
                {employees && employees.length > 0 ? (
                  employees.map((emp) => {
                    // 데이터 계산
                    const annual = calculateStats(emp.total_leave_days || 0, emp.used_leave_days || 0);
                    const extra = calculateStats(emp.extra_leave_days || 0, emp.extra_used_leave_days || 0);

                    return (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors group">
                        {/* 이름 및 부서 (Link 추가) */}
                        <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-gray-50 transition-colors border-r border-transparent group-hover:border-gray-200">
                            <Link href={`/schedule/${emp.id}`} className="flex items-center gap-3 group-hover:opacity-80">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                {emp.name.slice(0, 1)}
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 underline decoration-indigo-200 underline-offset-2 group-hover:text-indigo-600">
                                {emp.name}
                                </div>
                                <div className="text-xs text-gray-500">{emp.department || "부서미정"} · {emp.position || "직급없음"}</div>
                            </div>
                            </Link>
                        </td>

                        {/* --- 기본 연차 데이터 --- */}
                        <td className="px-4 py-4 text-right border-l border-gray-100 text-gray-600">
                          {Number(emp.total_leave_days).toFixed(1)}
                        </td>
                        <td className="px-4 py-4 text-right text-blue-600 font-medium">
                          {Number(emp.used_leave_days).toFixed(1)}
                        </td>
                        <td className={`px-4 py-4 text-right font-bold ${annual.remaining < 3 ? 'text-red-500' : 'text-gray-800'}`}>
                          {annual.remaining}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${Number(annual.rate) > 80 ? 'bg-red-400' : 'bg-blue-500'}`} 
                                style={{ width: `${annual.rate}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{Math.round(Number(annual.rate))}%</span>
                          </div>
                        </td>

                        {/* --- 보상 휴가 데이터 --- */}
                        <td className="px-4 py-4 text-right border-l border-gray-100 text-gray-600">
                          {Number(emp.extra_leave_days).toFixed(1)}
                        </td>
                        <td className="px-4 py-4 text-right text-orange-600 font-medium">
                          {Number(emp.extra_used_leave_days).toFixed(1)}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-gray-800">
                          {extra.remaining}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-400 rounded-full" 
                                style={{ width: `${extra.rate}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{Math.round(Number(extra.rate))}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                      등록된 일반 직원(Employee)이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
