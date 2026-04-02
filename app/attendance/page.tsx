"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Search, Smartphone, Monitor, Building2 } from "lucide-react";

interface EmployeeAttendance {
  id: string;
  name: string;
  department: string;
  position: string;
  clock_in: string | null;
  clock_out: string | null;
  status: '미출근' | '근무중' | '퇴근완료' | '자동마감';
  in_device?: string | null;
  out_device?: string | null;
}

interface GroupedAttendance {
  dept: string;
  employees: EmployeeAttendance[];
}

const getLocalToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function DeviceBadge({ device }: { device?: string | null }) {
  if (!device) return <span className="text-gray-300 text-xs">-</span>;
  
  const isMobile = device.toLowerCase().includes('mobile');
  
  return isMobile ? (
    <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md w-fit">
      <Smartphone className="w-3.5 h-3.5" /> 모바일
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-md w-fit">
      <Monitor className="w-3.5 h-3.5" /> PC
    </div>
  );
}

export default function AttendancePage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
  const [groupedList, setGroupedList] = useState<GroupedAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // ⭐️ [추가] 선택된 부서 상태 관리
  const [selectedDept, setSelectedDept] = useState<string>("전체");

  useEffect(() => {
    const fetchAttendanceData = async () => {
      setIsLoading(true);
      try {
        const [
          { data: profiles, error: profileError },
          { data: attendance, error: attendanceError },
          { data: sortData, error: sortError }
        ] = await Promise.all([
          supabase.from('profiles').select('id, name, department, position').is('resigned_at', null).neq("department", "외주"),
          supabase.from('attendance').select('user_id, clock_in, clock_out, is_auto_checkout, in_device, out_device').eq('date', selectedDate),
          supabase.from('sort_settings').select('*')
        ]);

        if (profileError) throw profileError;
        if (attendanceError) throw attendanceError;

        const dSorts: Record<string, number> = {};
        const eSorts: Record<string, number> = {};
        if (sortData) {
          sortData.forEach((s: any) => {
            if (s.target_type === 'department') dSorts[s.target_id] = s.sort_order;
            if (s.target_type === 'employee') eSorts[s.target_id] = s.sort_order;
          });
        }

        const mergedData: EmployeeAttendance[] = (profiles || []).map(profile => {
          const record = attendance?.find(a => a.user_id === profile.id) as any;
          
          let status: '미출근' | '근무중' | '퇴근완료' | '자동마감' = '미출근';
          if (record?.clock_in && !record?.clock_out) status = '근무중';
          if (record?.clock_in && record?.clock_out) {
            status = record.is_auto_checkout ? '자동마감' : '퇴근완료';
          }

          const formatTime = (isoString?: string | null) => {
            if (!isoString) return '-';
            return new Date(isoString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          };

          return {
            id: profile.id,
            name: profile.name,
            department: profile.department || '소속 없음',
            position: profile.position || '직급미지정',
            clock_in: formatTime(record?.clock_in),
            clock_out: formatTime(record?.clock_out),
            status,
            in_device: record?.in_device,
            out_device: record?.out_device,
          };
        });

        const uniqueDepts = Array.from(new Set(mergedData.map(emp => emp.department)));
        const sortedDepts = uniqueDepts.sort((a, b) => (dSorts[a] ?? 99) - (dSorts[b] ?? 99));

        const grouped = sortedDepts.map(dept => {
          const emps = mergedData.filter(emp => emp.department === dept);
          emps.sort((a, b) => (eSorts[a.id] ?? 99) - (eSorts[b.id] ?? 99));
          return { dept, employees: emps };
        });

        setGroupedList(grouped);
      } catch (error) {
        console.error("출퇴근 명부 조회 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendanceData();
  }, [selectedDate, supabase]);

  // ⭐️ [추가] 존재하는 부서 목록 추출 (필터 버튼용)
  const availableDepts = ["전체", ...groupedList.map(g => g.dept)];

  // ⭐️ [수정] 검색어 필터링 + 부서 필터링 동시 적용
  const filteredGroupedList = groupedList
    .filter(group => selectedDept === "전체" || group.dept === selectedDept) // 부서 필터 적용
    .map(group => ({
      dept: group.dept,
      employees: group.employees.filter(emp => 
        emp.name.includes(searchTerm) || group.dept.includes(searchTerm)
      )
    }))
    .filter(group => group.employees.length > 0);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-[95%] mx-auto space-y-6">
        
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                전체 직원 출퇴근 명부
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                팀원들의 당일 출퇴근 현황 및 접속 기기를 확인합니다.
              </p>
            </div>
          </div>
        </div>

        {/* ⭐️ [수정] 필터 영역 (날짜/검색 + 부서 필터) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="이름 또는 부서 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* ⭐️ [추가] 부서별 필터 버튼 영역 */}
          {!isLoading && groupedList.length > 0 && (
            <div className="pt-2 border-t border-gray-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {availableDepts.map(dept => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                    selectedDept === dept 
                      ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-200" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 리스트 렌더링 영역 */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
            데이터를 불러오는 중입니다...
          </div>
        ) : filteredGroupedList.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
            검색 결과가 없습니다.
          </div>
        ) : (
          <div className="space-y-8">
            {filteredGroupedList.map((group) => (
              <div key={group.dept} className="space-y-3 animate-in fade-in duration-300">
                
                {/* 🏢 부서 헤더 */}
                <div className="flex items-center gap-2 px-1">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-gray-800">{group.dept}</h2>
                  <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2.5 py-0.5 rounded-full ml-1">
                    {group.employees.length}명
                  </span>
                </div>

                {/* 🖥️ [PC 뷰] 부서별 테이블 */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                        <th className="p-4 font-semibold w-[200px]">이름 / 직급</th>
                        <th className="p-4 font-semibold w-[150px]">출근 시간</th>
                        <th className="p-4 font-semibold w-[150px]">출근 기기</th>
                        <th className="p-4 font-semibold w-[150px]">퇴근 시간</th>
                        <th className="p-4 font-semibold w-[150px]">퇴근 기기</th>
                        <th className="p-4 font-semibold text-center w-[120px]">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.employees.map((emp) => (
                        <tr 
                          key={emp.id} 
                          onClick={() => router.push(`/attendance/${emp.id}`)}
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs group-hover:bg-blue-200 transition-colors">
                                {emp.name.substring(0, 1)}
                              </div>
                              <div>
                                <div className="font-bold text-gray-800">{emp.name}</div>
                                <div className="text-xs text-gray-500">{emp.position}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm font-medium text-gray-800">{emp.clock_in}</td>
                          <td className="p-4">{emp.clock_in !== '-' && <DeviceBadge device={emp.in_device} />}</td>
                          <td className="p-4 text-sm font-medium text-gray-800">{emp.clock_out}</td>
                          <td className="p-4">{emp.clock_out !== '-' && <DeviceBadge device={emp.out_device} />}</td>
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              emp.status === '근무중' ? 'bg-green-100 text-green-700' :
                              emp.status === '자동마감' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                              emp.status === '퇴근완료' ? 'bg-gray-100 text-gray-600' :
                              'bg-red-50 text-red-500'
                            }`}>
                              {emp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 📱 [모바일 뷰] 부서별 카드 리스트 */}
                <div className="block md:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                  {group.employees.map((emp) => (
                    <div 
                      key={emp.id} 
                      onClick={() => router.push(`/attendance/${emp.id}`)}
                      className="p-4 hover:bg-blue-50/50 transition-colors cursor-pointer active:bg-blue-50 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                            {emp.name.substring(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                              {emp.name} 
                              <span className="text-xs text-gray-500 font-normal">{emp.position}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          emp.status === '근무중' ? 'bg-green-100 text-green-700' :
                          emp.status === '자동마감' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                          emp.status === '퇴근완료' ? 'bg-gray-100 text-gray-600' :
                          'bg-red-50 text-red-500'
                        }`}>
                          {emp.status}
                        </span>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500 font-medium">출근</span>
                          <div className="font-bold text-gray-800 text-sm">{emp.clock_in}</div>
                          {emp.clock_in !== '-' && (
                            <div className="mt-0.5">
                              <DeviceBadge device={emp.in_device} />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 border-l border-gray-200 pl-3">
                          <span className="text-xs text-gray-500 font-medium">퇴근</span>
                          <div className="font-bold text-gray-800 text-sm">{emp.clock_out}</div>
                          {emp.clock_out !== '-' && (
                            <div className="mt-0.5">
                              <DeviceBadge device={emp.out_device} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
