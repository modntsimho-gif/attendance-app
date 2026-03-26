"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Search, MapPin } from "lucide-react";
import { NavermapsProvider, useNavermaps } from "react-naver-maps";

// 📍 [핵심 수정] 좌표 변환 컴포넌트 (문자열/숫자 모두 처리 + 디버깅 강화)
function AddressCell({ lat, lng }: { lat?: any, lng?: any }) {
  const navermaps = useNavermaps();
  const [address, setAddress] = useState<string>("-");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. 데이터가 없으면 무시
    if (!lat || !lng) return;

    // 2. 강제 숫자 변환 (DB에서 문자로 올 경우 대비)
    const nLat = Number(lat);
    const nLng = Number(lng);

    // 3. 유효한 숫자가 아니면 중단
    if (isNaN(nLat) || isNaN(nLng) || nLat === 0) {
      console.warn("유효하지 않은 좌표:", lat, lng);
      return;
    }

    // 4. 네이버 맵 로드 확인
    if (!navermaps || !navermaps.Service) {
      // 아직 로딩 안됐으면 대기 (로그는 생략)
      return;
    }

    setLoading(true);

    try {
      const latlng = new navermaps.LatLng(nLat, nLng);
      
      navermaps.Service.reverseGeocode(
        {
          coords: latlng,
          orders: [
            navermaps.Service.OrderType.ROAD_ADDR,
            navermaps.Service.OrderType.ADDR
          ].join(',')
        },
        (status: any, response: any) => {
          setLoading(false);
          if (status === navermaps.Service.Status.OK) {
            const result = response.v2.address;
            const finalAddr = result.roadAddress || result.jibunAddress;
            setAddress(finalAddr);
          } else {
            console.error("주소 변환 실패 (Status):", status);
            setAddress("주소 변환 불가");
          }
        }
      );
    } catch (e) {
      console.error("네이버 맵 에러:", e);
      setLoading(false);
      setAddress("에러 발생");
    }
  }, [lat, lng, navermaps]);

  if (!lat || !lng) return <span className="text-gray-300 text-xs">-</span>;
  if (loading) return <span className="text-blue-500 text-xs animate-pulse">위치 확인 중...</span>;

  return (
    <div className="flex items-start gap-1 group relative">
      <MapPin className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
      <span className="truncate max-w-[180px] block text-xs text-gray-600" title={address}>
        {address}
      </span>
    </div>
  );
}

interface EmployeeAttendance {
  id: string;
  name: string;
  department: string;
  position: string;
  clock_in: string | null;
  clock_out: string | null;
  status: '미출근' | '근무중' | '퇴근완료' | '자동마감';
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
}

const getLocalToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AttendancePage() {
  const supabase = createClient();
  const router = useRouter();
  
  // ⭐️ 환경변수 확인용 로그 (브라우저 콘솔에서 확인)
  const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || "";
  
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
  const [attendanceList, setAttendanceList] = useState<EmployeeAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    console.log("현재 적용된 Client ID:", NAVER_CLIENT_ID ? "설정됨 (OK)" : "❌ 없음 (확인 필요)");
  }, [NAVER_CLIENT_ID]);

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

        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance')
          .select('user_id, clock_in, clock_out, is_auto_checkout, start_lat, start_lng, end_lat, end_lng')
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
            start_lat: record?.start_lat,
            start_lng: record?.start_lng,
            end_lat: record?.end_lat,
            end_lng: record?.end_lng,
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
    <NavermapsProvider ncpClientId={NAVER_CLIENT_ID} submodules={['geocoder']}>
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
                  팀원들의 당일 출퇴근 현황 및 위치를 확인합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="이름 또는 부서 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                    <th className="p-4 font-semibold w-[150px]">이름 / 직급</th>
                    <th className="p-4 font-semibold w-[120px]">부서</th>
                    <th className="p-4 font-semibold w-[100px]">출근 시간</th>
                    <th className="p-4 font-semibold w-[200px]">출근 위치</th>
                    <th className="p-4 font-semibold w-[100px]">퇴근 시간</th>
                    <th className="p-4 font-semibold w-[200px]">퇴근 위치</th>
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
                        
                        {/* 📍 출근 위치 */}
                        <td className="p-4">
                          <AddressCell lat={emp.start_lat} lng={emp.start_lng} />
                        </td>

                        <td className="p-4 text-sm font-medium text-gray-800">{emp.clock_out}</td>
                        
                        {/* 📍 퇴근 위치 */}
                        <td className="p-4">
                          <AddressCell lat={emp.end_lat} lng={emp.end_lng} />
                        </td>

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
          </div>
        </div>
      </main>
    </NavermapsProvider>
  );
}
