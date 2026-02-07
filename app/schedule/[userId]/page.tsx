import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

// ⭐️ [수정 1] params 타입을 Promise로 변경
interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  
  // ⭐️ [수정 2] params를 await로 기다린 후 userId 추출
  const { userId } = await params;

  // 1. 병렬로 데이터 조회 (프로필, 휴가내역, 초과근무내역)
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

  // 상태 뱃지 렌더링 헬퍼
  const renderStatus = (status: string) => {
    switch (status) {
      case "approved": return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><CheckCircle2 className="w-3 h-3"/> 승인됨</span>;
      case "rejected": return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3"/> 반려됨</span>;
      case "cancelled": return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><XCircle className="w-3 h-3"/> 취소됨</span>;
      default: return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><AlertCircle className="w-3 h-3"/> 대기중</span>;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* 헤더 & 프로필 요약 */}
        <div>
          <Link href="/schedule" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> 목록으로 돌아가기
          </Link>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl">
                {profile.name.slice(0, 1)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
                <p className="text-gray-500">{profile.department} · {profile.position}</p>
                <div className="text-xs text-gray-400 mt-1">입사일: {profile.join_date || '-'}</div>
              </div>
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <div className="flex-1 md:flex-none bg-blue-50 p-4 rounded-lg border border-blue-100 text-center min-w-[120px]">
                <div className="text-xs text-blue-600 font-bold mb-1">잔여 연차</div>
                <div className="text-2xl font-bold text-gray-800">
                  {Number(profile.total_leave_days - profile.used_leave_days).toFixed(1)}
                  <span className="text-sm font-normal text-gray-400 ml-1">/ {Number(profile.total_leave_days).toFixed(1)}</span>
                </div>
              </div>
              <div className="flex-1 md:flex-none bg-orange-50 p-4 rounded-lg border border-orange-100 text-center min-w-[120px]">
                <div className="text-xs text-orange-600 font-bold mb-1">잔여 보상휴가</div>
                <div className="text-2xl font-bold text-gray-800">
                  {Number(profile.extra_leave_days - profile.extra_used_leave_days).toFixed(1)}
                  <span className="text-sm font-normal text-gray-400 ml-1">/ {Number(profile.extra_leave_days).toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 1. 휴가 신청 내역 (사용 이력) */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              휴가 사용 내역
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {leaves.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">사용 내역이 없습니다.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {leaves.map((leave) => (
                    <div key={leave.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            leave.leave_type === '연차' ? 'bg-blue-100 text-blue-700' : 
                            leave.leave_type.includes('대체') ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {leave.leave_type}
                          </span>
                          <span className="text-sm font-bold text-gray-800">
                            {leave.start_date === leave.end_date ? leave.start_date : `${leave.start_date} ~ ${leave.end_date}`}
                          </span>
                        </div>
                        {renderStatus(leave.status)}
                      </div>
                      
                      <div className="flex justify-between items-end">
                        <div className="text-sm text-gray-600">
                          <div className="mb-1">{leave.reason}</div>
                          {leave.overtime_requests && (
                            <div className="text-xs text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded w-fit">
                              <Clock className="w-3 h-3" />
                              원천: {leave.overtime_requests.title}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-800">-{Number(leave.total_leave_days).toFixed(2)}<span className="text-xs font-normal text-gray-400">일</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 2. 초과근무 내역 (발생 및 소진 추적) */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              초과근무 발생 및 소진 현황
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {overtimes.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">초과근무 내역이 없습니다.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {overtimes.map((ot) => {
                    const total = Number(ot.recognized_hours || 0);
                    const used = Number(ot.used_hours || 0);
                    const remaining = total - used;
                    const percent = total > 0 ? (used / total) * 100 : 0;
                    const isFullyUsed = remaining <= 0 && total > 0;

                    return (
                      <div key={ot.id} className={`p-4 transition-colors ${isFullyUsed ? 'bg-gray-50 opacity-70' : 'bg-white hover:bg-orange-50/30'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                              {ot.title}
                              {isFullyUsed && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 rounded">소진완료</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {ot.work_date} 
                              <span className="text-gray-300">|</span> 
                              {ot.start_time.slice(0,5)}~{ot.end_time.slice(0,5)}
                            </div>
                          </div>
                          {renderStatus(ot.status)}
                        </div>

                        {ot.status === 'approved' && (
                          <div className="mt-3 bg-gray-50 rounded-lg p-2 border border-gray-100">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">사용 현황 (시간)</span>
                              <span className="font-bold text-gray-700">
                                <span className="text-orange-600">{used}h 사용</span> / {total}h 인정
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${isFullyUsed ? 'bg-gray-400' : 'bg-orange-500'}`} 
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                            <div className="text-right mt-1">
                                {remaining > 0 ? (
                                    <span className="text-xs font-bold text-blue-600">잔여 {remaining}시간</span>
                                ) : (
                                    <span className="text-xs text-gray-400">잔여 없음</span>
                                )}
                            </div>
                          </div>
                        )}
                        
                        {ot.status !== 'approved' && (
                            <div className="mt-2 text-xs text-gray-400">
                                승인 대기 또는 반려된 항목입니다.
                            </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
