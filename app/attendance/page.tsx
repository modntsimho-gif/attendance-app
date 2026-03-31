"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Search, Smartphone, Monitor } from "lucide-react";

interface EmployeeAttendance {
  id: string;
  name: string;
  department: string;
  position: string;
  clock_in: string | null;
  clock_out: string | null;
  status: '미출근' | '근무중' | '퇴근완료' | '자동마감';
  in_device?: string | null;  // [NEW] 출근 기기 정보
  out_device?: string | null; // [NEW] 퇴근 기기 정보
}

const getLocalToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 📱 [NEW] 기기 아이콘 렌더링 컴포넌트
function DeviceBadge({ device }: { device?: string | null }) {
  if (!device) return <span className="text-gray-300 text-xs">-</span>;
  
  // 'mobile'이라는 단어가 포함되어 있으면 모바일로 간주, 그 외는 PC로 간주
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
  const [attendanceList, setAttendanceList] = useState<EmployeeAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchAttendanceData = async () => {
      setIsLoading(true);
      try {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, name, department, position')
          .is('resigned_at', null)
          .neq("department", "외주") 
          .order('name');

        if (profileError) throw profileError;

        // ⭐️ DB 쿼리 수정: 위치 데이터 대신 in_device, out_device를 가져옵니다.
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance')
          .select('user_id, clock_in, clock_out, is_auto_checkout, in_device, out_device')
          .eq('date', selectedDate);

        if (attendanceError) throw attendanceError;

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
            department: profile.department || '부서미지정',
            position: profile.position || '직급미지정',
            clock_in: formatTime(record?.clock_in),
            clock_out: formatTime(record?.clock_out),
            status,
            in_device: record?.in_device,   // DB에서 가져온 출근 기기
            out_device: record?.out_device, // DB에서 가져온 퇴근 기기
          };
        });

        setAttendanceList(mergedData);
      } catch (error) {
        console.error("출퇴근 명부 조회 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendanceData();
  }, [selectedDate, supabase]);

  const filteredList = attendanceList.filter(emp => 
    emp.name.includes(searchTerm) || emp.department.includes(searchTerm)
  );

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-[95%] mx-auto space-y-6">
        
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

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
          
          {/* 날짜 선택기 */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              // ⭐️ text-gray-900 bg-white 추가
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          {/* 검색창 */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="이름 또는 부서 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              // ⭐️ text-gray-900 bg-white 추가
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* 🖥️ [PC 뷰] 화면이 넓을 때(md 이상)만 보이는 테이블 형태 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                  <th className="p-4 font-semibold w-[150px]">이름 / 직급</th>
                  <th className="p-4 font-semibold w-[120px]">부서</th>
                  <th className="p-4 font-semibold w-[120px]">출근 시간</th>
                  <th className="p-4 font-semibold w-[120px]">출근 기기</th>
                  <th className="p-4 font-semibold w-[120px]">퇴근 시간</th>
                  <th className="p-4 font-semibold w-[120px]">퇴근 기기</th>
                  <th className="p-4 font-semibold text-center w-[100px]">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">데이터를 불러오는 중입니다...</td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">검색 결과가 없습니다.</td>
                  </tr>
                ) : (
                  filteredList.map((emp) => (
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
                      <td className="p-4 text-sm text-gray-600">{emp.department}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 📱 [모바일 뷰] 화면이 좁을 때(md 미만)만 보이는 카드 형태 */}
          <div className="block md:hidden divide-y divide-gray-100">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">데이터를 불러오는 중입니다...</div>
            ) : filteredList.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">검색 결과가 없습니다.</div>
            ) : (
              filteredList.map((emp) => (
                <div 
                  key={emp.id} 
                  onClick={() => router.push(`/attendance/${emp.id}`)}
                  className="p-4 hover:bg-blue-50/50 transition-colors cursor-pointer active:bg-blue-50 flex flex-col gap-3"
                >
                  {/* 상단: 프로필, 이름, 부서, 상태 배지 */}
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
                        <div className="text-xs text-gray-500 mt-0.5">{emp.department}</div>
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

                  {/* 하단: 출퇴근 시간 및 기기 정보 박스 */}
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
              ))
            )}
          </div>

        </div>
      </div>
    </main>
  );
}