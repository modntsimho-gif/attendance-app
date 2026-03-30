"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, User, Smartphone, Monitor } from "lucide-react";

interface EmployeeProfile {
  name: string;
  department: string;
  position: string;
}

interface AttendanceRecord {
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: '근무중' | '퇴근완료' | '자동마감';
  in_device?: string | null;  // ⭐️ 출근 기기 추가
  out_device?: string | null; // ⭐️ 퇴근 기기 추가
}

// 📱 [NEW] 기기 아이콘 렌더링 컴포넌트 추가
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

export default function EmployeeAttendanceDetail() {
  const params = useParams();
  const userId = params.id as string;
  const supabase = createClient();

  const currentYear = new Date().getFullYear();
  
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [years, setYears] = useState<string[]>([]); 
  
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1️⃣ 연도 드롭다운 목록 생성
  useEffect(() => {
    const fetchYearRange = async () => {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('date')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        let maxYear = currentYear; 

        if (data && data.date) {
          const dataYear = new Date(data.date).getFullYear();
          if (dataYear > maxYear) {
            maxYear = dataYear;
          }
        }

        const startYear = 2026; 
        
        const generatedYears = Array.from(
          { length: maxYear - startYear + 1 }, 
          (_, i) => (maxYear - i).toString()
        );
        
        setYears(generatedYears);
      } catch (error) {
        console.error("연도 범위 조회 실패:", error);
        const fallbackYears = Array.from(
          { length: currentYear - 2026 + 1 }, 
          (_, i) => (currentYear - i).toString()
        );
        setYears(fallbackYears.length > 0 ? fallbackYears : ['2026']);
      }
    };

    if (userId) fetchYearRange();
  }, [userId, currentYear, supabase]);

  // 2️⃣ 선택한 연도의 상세 데이터 조회
  useEffect(() => {
    const fetchDetailData = async () => {
      setIsLoading(true);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('name, department, position')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;

        // ⭐️ [수정] in_device, out_device 컬럼 추가 조회
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('date, clock_in, clock_out, is_auto_checkout, in_device, out_device')
          .eq('user_id', userId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        if (attendanceError) throw attendanceError;

        const formattedRecords: AttendanceRecord[] = (attendanceData || []).map(record => {
          let status: '근무중' | '퇴근완료' | '자동마감' = '근무중';
          if (record.clock_in && record.clock_out) {
            status = record.is_auto_checkout ? '자동마감' : '퇴근완료';
          }

          return {
            date: record.date,
            clock_in: record.clock_in ? new Date(record.clock_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-',
            clock_out: record.clock_out ? new Date(record.clock_out).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-',
            status,
            in_device: record.in_device,   // ⭐️ 출근 기기 매핑
            out_device: record.out_device  // ⭐️ 퇴근 기기 매핑
          };
        });

        setRecords(formattedRecords);
      } catch (error) {
        console.error("상세 기록 조회 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId && selectedYear) fetchDetailData();
  }, [userId, selectedYear, supabase]);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/attendance" className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <User className="w-6 h-6 text-blue-600" />
                {profile ? `${profile.name}님의 출퇴근 기록` : '출퇴근 기록 로딩중...'}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                {profile ? `${profile.department} | ${profile.position}` : '직원 정보를 불러오고 있습니다.'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-bold text-gray-700">조회 연도</span>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          <span className="text-sm text-gray-500 ml-auto">
            총 <strong className="text-blue-600">{records.length}</strong>일의 기록이 있습니다.
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-gray-50 shadow-sm z-10">
                <tr className="border-b border-gray-100 text-sm text-gray-500">
                  <th className="p-4 font-semibold w-[120px]">날짜</th>
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
                    <td colSpan={6} className="p-10 text-center text-gray-400">데이터를 불러오는 중입니다...</td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-gray-400 bg-gray-50/50">해당 연도에 기록된 출퇴근 내역이 없습니다.</td>
                  </tr>
                ) : (
                  records.map((record, index) => (
                    <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-medium text-gray-800">{record.date}</td>
                      <td className="p-4 text-sm font-medium text-blue-600">{record.clock_in}</td>
                      <td className="p-4">
                        {record.clock_in !== '-' ? <DeviceBadge device={record.in_device} /> : null}
                      </td>
                      <td className="p-4 text-sm font-medium text-red-500">{record.clock_out}</td>
                      <td className="p-4">
                        {record.clock_out !== '-' ? <DeviceBadge device={record.out_device} /> : null}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          record.status === '근무중' ? 'bg-green-100 text-green-700' : 
                          record.status === '자동마감' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
