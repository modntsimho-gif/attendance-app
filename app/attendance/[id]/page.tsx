"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, User, Smartphone, Monitor, Clock } from "lucide-react";

interface EmployeeProfile {
  name: string;
  department: string;
  position: string;
}

interface AttendanceRecord {
  date: string;
  dayOfWeek: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  in_device?: string | null;
  out_device?: string | null;
}

// 📱 기기 아이콘 배지
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

// 🏷️ 상태 배지 (공휴일 스타일 추가)
const StatusBadge = ({ status }: { status: string }) => {
  const style = 
    status === '근무중' ? 'bg-green-100 text-green-700' : 
    status === '자동마감' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 
    status === '퇴근완료' ? 'bg-gray-100 text-gray-600' : 
    status === '미출근' ? 'bg-red-50 text-red-500' : 
    status === '휴무' ? 'bg-gray-50 text-gray-400 border border-gray-200' : 
    status === '공휴일' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
    'bg-pink-50 text-pink-600 border border-pink-100'; 
    
  return <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${style}`}>{status}</span>;
};

// 🌴 휴가 데이터 매핑 함수
function processUserLeaves(data: any[]) {
  const map = new Map<string, string>();
  const groups: Record<string, any[]> = {};
  
  (data || []).forEach(req => {
    const k = req.original_leave_request_id || req.id;
    if (!groups[k]) groups[k] = [];
    groups[k].push(req);
  });

  Object.values(groups).forEach((g: any[]) => {
    g.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const { status, request_type, start_date, end_date, leave_type } = g[0];
    
    if (status === 'approved' && request_type !== 'cancel') {
      const start = new Date(start_date.substring(0, 10) + 'T00:00:00');
      const end = new Date(end_date.substring(0, 10) + 'T00:00:00');
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        map.set(dateStr, leave_type);
      }
    }
  });
  
  return map;
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

  useEffect(() => {
    const fetchYearRange = async () => {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('date')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1);

        if (error) throw error;

        let maxYear = currentYear; 
        if (data && data.length > 0 && data[0].date) {
          const dataYear = new Date(data[0].date).getFullYear();
          if (dataYear > maxYear) maxYear = dataYear;
        }

        const startYear = 2026; 
        const generatedYears = Array.from({ length: maxYear - startYear + 1 }, (_, i) => (maxYear - i).toString());
        setYears(generatedYears);
      } catch (error) {
        console.error("연도 범위 조회 실패:", error);
        setYears([currentYear.toString()]);
      }
    };
    if (userId) fetchYearRange();
  }, [userId, currentYear, supabase]);

  useEffect(() => {
    const fetchDetailData = async () => {
      setIsLoading(true);
      try {
        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;

        // ⭐️ public_holidays 테이블 추가 조회
        const [ { data: profileData }, { data: attendanceData }, { data: leaveData }, { data: holidayData } ] = await Promise.all([
          supabase.from('profiles').select('name, department, position').eq('id', userId).single(),
          supabase.from('attendance').select('date, clock_in, clock_out, is_auto_checkout, in_device, out_device').eq('user_id', userId).gte('date', startDate).lte('date', endDate),
          supabase.from('leave_requests').select('*').eq('user_id', userId).lte('start_date', endDate).gte('end_date', startDate),
          supabase.from('public_holidays').select('date').gte('date', startDate).lte('date', endDate)
        ]);

        setProfile(profileData);
        const leaveMap = processUserLeaves(leaveData || []);
        
        // ⭐️ 공휴일 Set 생성
        const holidaySet = new Set((holidayData || []).map(h => h.date));

        const today = new Date();
        const localTodayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        let endLimitDateStr = `${selectedYear}-12-31`;
        if (selectedYear === currentYear.toString()) {
          endLimitDateStr = localTodayStr; 
        }

        const allDates: string[] = [];
        const startD = new Date(`${selectedYear}-01-01T00:00:00`);
        const endD = new Date(`${endLimitDateStr}T00:00:00`);
        
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          allDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        
        allDates.sort((a, b) => b.localeCompare(a));

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

        const formattedRecords: AttendanceRecord[] = allDates.map(dateStr => {
          const record = attendanceData?.find(a => a.date === dateStr);
          
          // ⭐️ 날짜 버그 방지를 위해 T00:00:00 추가
          const d = new Date(`${dateStr}T00:00:00`);
          const dayOfWeek = dayNames[d.getDay()];
          const isWeekend = d.getDay() === 0 || d.getDay() === 6; 
          const isHoliday = holidaySet.has(dateStr);

          let status = '';
          const hasLeave = leaveMap.has(dateStr);
          const leaveType = hasLeave ? leaveMap.get(dateStr)! : '';

          // ⭐️ 상태 판별 로직 (공휴일 반영)
          if (record?.clock_in) {
            if (!record.clock_out) {
              status = '근무중';
            } else {
              status = hasLeave ? leaveType : (record.is_auto_checkout ? '자동마감' : '퇴근완료');
            }
          } else {
            if (hasLeave) status = leaveType;
            else if (isHoliday) status = '공휴일';
            else if (isWeekend) status = '휴무';
            else status = '미출근';
          }

          return {
            date: dateStr,
            dayOfWeek,
            clock_in: record?.clock_in ? new Date(record.clock_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-',
            clock_out: record?.clock_out ? new Date(record.clock_out).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-',
            status,
            in_device: record?.in_device,
            out_device: record?.out_device
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
  }, [userId, selectedYear, currentYear, supabase]);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        
        {/* ⭐️ 헤더 영역 (인디고 테마 적용) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Link href="/attendance" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-2 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> 목록으로 돌아가기
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <User className="w-6 h-6 text-indigo-600" />
              {profile ? `${profile.name}님의 출퇴근 기록` : '출퇴근 기록 로딩중...'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {profile ? `${profile.department} | ${profile.position}` : '직원 정보를 불러오고 있습니다.'}
            </p>
          </div>

          <div className="relative w-full sm:w-auto">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full sm:w-auto appearance-none bg-white border border-gray-300 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm cursor-pointer"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}년 조회</option>
              ))}
            </select>
            <Calendar className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* ⭐️ 요약 박스 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <Clock className="w-5 h-5 text-indigo-500" />
             <span className="font-bold text-gray-700">{selectedYear}년 누적 기록</span>
          </div>
          <span className="text-sm text-gray-500">
            총 <strong className="text-indigo-600 text-lg">{records.length}</strong>일
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          
          {/* 🖥️ [PC 뷰] 투톤 테이블 적용 */}
          <div className="hidden md:block overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-gray-50 shadow-sm z-10">
                <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold w-[140px]">날짜</th>
                  <th className="px-4 py-4 font-bold text-center w-[100px]">상태</th>
                  <th className="px-4 py-4 font-bold border-l border-gray-200 bg-blue-50/50 text-blue-800 w-[120px]">출근 시간</th>
                  <th className="px-4 py-4 font-bold bg-blue-50/50 text-blue-800 w-[140px]">출근 기기</th>
                  <th className="px-4 py-4 font-bold border-l border-gray-200 bg-red-50/50 text-red-800 w-[120px]">퇴근 시간</th>
                  <th className="px-4 py-4 font-bold bg-red-50/50 text-red-800 w-[140px]">퇴근 기기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-10 text-center text-gray-400">데이터를 불러오는 중입니다...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-gray-400 bg-gray-50/50">해당 연도에 기록된 출퇴근 내역이 없습니다.</td></tr>
                ) : (
                  records.map((record, index) => (
                    <tr key={index} className="hover:bg-indigo-50/60 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {record.date}
                        <span className={`ml-1 text-xs ${record.dayOfWeek === '토' ? 'text-blue-500' : record.dayOfWeek === '일' ? 'text-red-500' : 'text-gray-400'}`}>
                          ({record.dayOfWeek})
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center"><StatusBadge status={record.status} /></td>
                      <td className="px-4 py-4 text-blue-600 font-bold border-l border-gray-100">{record.clock_in}</td>
                      <td className="px-4 py-4">{record.clock_in !== '-' ? <DeviceBadge device={record.in_device} /> : null}</td>
                      <td className="px-4 py-4 text-red-500 font-bold border-l border-gray-100">{record.clock_out}</td>
                      <td className="px-4 py-4">{record.clock_out !== '-' ? <DeviceBadge device={record.out_device} /> : null}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 📱 [모바일 뷰] 투톤 카드 적용 */}
          <div className="block md:hidden divide-y divide-gray-100 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-10 text-center text-gray-400 text-sm">데이터를 불러오는 중입니다...</div>
            ) : records.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm bg-gray-50/50">해당 연도에 기록된 출퇴근 내역이 없습니다.</div>
            ) : (
              records.map((record, index) => (
                <div key={index} className="p-4 hover:bg-indigo-50/60 transition-colors flex flex-col gap-4 group">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-gray-900 text-base flex items-center gap-2 group-hover:text-indigo-700 transition-colors">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      {record.date}
                      <span className={`text-sm font-medium ${record.dayOfWeek === '토' ? 'text-blue-500' : record.dayOfWeek === '일' ? 'text-red-500' : 'text-gray-400'}`}>
                        ({record.dayOfWeek})
                      </span>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50/30 rounded-lg p-3 border border-blue-100/50">
                      <div className="text-xs text-gray-500 font-medium mb-1">출근</div>
                      <div className="font-bold text-blue-600 text-base">{record.clock_in}</div>
                      {record.clock_in !== '-' && <div className="mt-2"><DeviceBadge device={record.in_device} /></div>}
                    </div>
                    <div className="bg-red-50/30 rounded-lg p-3 border border-red-100/50">
                      <div className="text-xs text-gray-500 font-medium mb-1">퇴근</div>
                      <div className="font-bold text-red-500 text-base">{record.clock_out}</div>
                      {record.clock_out !== '-' && <div className="mt-2"><DeviceBadge device={record.out_device} /></div>}
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
