"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Search, Smartphone, Monitor, Building2, Download, X, CheckSquare } from "lucide-react";
import * as XLSX from "xlsx";

interface EmployeeAttendance {
  id: string; name: string; department: string; position: string;
  clock_in: string | null; clock_out: string | null;
  status: '미출근' | '근무중' | '퇴근완료' | '자동마감';
  in_device?: string | null; out_device?: string | null;
}

const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DeviceBadge = ({ device }: { device?: string | null }) => {
  if (!device) return <span className="text-gray-300 text-xs">-</span>;
  const isMobile = device.toLowerCase().includes('mobile');
  const Icon = isMobile ? Smartphone : Monitor;
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md w-fit border ${isMobile ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-purple-700 bg-purple-50 border-purple-100'}`}>
      <Icon className="w-3.5 h-3.5" /> {isMobile ? '모바일' : 'PC'}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const style = status === '근무중' ? 'bg-green-100 text-green-700' :
                status === '자동마감' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                status === '퇴근완료' ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-500';
  return <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${style}`}>{status}</span>;
};

const Avatar = ({ name }: { name: string }) => (
  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs md:text-sm shrink-0 group-hover:bg-blue-200 transition-colors">
    {name.substring(0, 1)}
  </div>
);

export default function AttendancePage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
  const [groupedList, setGroupedList] = useState<{ dept: string; employees: EmployeeAttendance[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("전체");

  // ⭐️ 엑셀 다운로드 관련 상태
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelStartDate, setExcelStartDate] = useState(getLocalToday());
  const [excelEndDate, setExcelEndDate] = useState(getLocalToday());
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]); // 선택된 직원 ID 배열
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [ { data: p }, { data: a }, { data: s } ] = await Promise.all([
          supabase.from('profiles').select('id, name, department, position').is('resigned_at', null).neq("department", "외주"),
          supabase.from('attendance').select('user_id, clock_in, clock_out, is_auto_checkout, in_device, out_device').eq('date', selectedDate),
          supabase.from('sort_settings').select('*')
        ]);

        const dSorts: Record<string, number> = {}, eSorts: Record<string, number> = {};
        s?.forEach(x => (x.target_type === 'department' ? dSorts : eSorts)[x.target_id] = x.sort_order);

        const merged: EmployeeAttendance[] = (p || []).map(prof => {
          const rec = a?.find(x => x.user_id === prof.id) as any;
          const format = (t?: string) => t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-';
          const status = rec?.clock_in ? (rec.clock_out ? (rec.is_auto_checkout ? '자동마감' : '퇴근완료') : '근무중') : '미출근';
          return { ...prof, department: prof.department || '소속 없음', position: prof.position || '직급미지정', clock_in: format(rec?.clock_in), clock_out: format(rec?.clock_out), status, in_device: rec?.in_device, out_device: rec?.out_device };
        });

        const depts = Array.from(new Set(merged.map(x => x.department))).sort((x, y) => (dSorts[x] ?? 99) - (dSorts[y] ?? 99));
        setGroupedList(depts.map(dept => ({ dept, employees: merged.filter(x => x.department === dept).sort((x, y) => (eSorts[x.id] ?? 99) - (eSorts[y.id] ?? 99)) })));
      } catch (e) { console.error("출퇴근 명부 조회 실패:", e); } finally { setIsLoading(false); }
    })();
  }, [selectedDate, supabase]);

  // ⭐️ 모달 열기 (열 때 모든 직원을 기본 선택 상태로)
  const openExcelModal = () => {
    const allIds = groupedList.flatMap(g => g.employees.map(e => e.id));
    setSelectedUserIds(allIds);
    setIsExcelModalOpen(true);
  };

  // ⭐️ 전체 선택 토글
  const allEmployeeIds = groupedList.flatMap(g => g.employees.map(e => e.id));
  const handleToggleAll = () => {
    if (selectedUserIds.length === allEmployeeIds.length) setSelectedUserIds([]); // 모두 해제
    else setSelectedUserIds(allEmployeeIds); // 모두 선택
  };

  // ⭐️ 개별 직원 선택 토글
  const handleToggleUser = (id: string) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]);
  };

  // ⭐️ 엑셀 다운로드 실행
  const handleExportExcel = async () => {
    if (excelStartDate > excelEndDate) return alert("시작일이 종료일보다 클 수 없습니다.");
    if (selectedUserIds.length === 0) return alert("출력할 직원을 최소 1명 이상 선택해주세요.");
    setIsExporting(true);
    
    try {
      const [ { data: p }, { data: a }, { data: s } ] = await Promise.all([
        supabase.from('profiles').select('id, name, department, position').is('resigned_at', null).neq("department", "외주"),
        supabase.from('attendance').select('user_id, date, clock_in, clock_out, is_auto_checkout, in_device, out_device').gte('date', excelStartDate).lte('date', excelEndDate),
        supabase.from('sort_settings').select('*')
      ]);

      const dSorts: Record<string, number> = {}, eSorts: Record<string, number> = {};
      s?.forEach(x => (x.target_type === 'department' ? dSorts : eSorts)[x.target_id] = x.sort_order);

      // 선택한 직원만 필터링
      const targetProfiles = (p || []).filter(prof => selectedUserIds.includes(prof.id));
      const excelData: any[] = [];
      
      const [sY, sM, sD] = excelStartDate.split('-').map(Number);
      const [eY, eM, eD] = excelEndDate.split('-').map(Number);
      const start = new Date(sY, sM - 1, sD);
      const end = new Date(eY, eM - 1, eD);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        let dailyMerged = targetProfiles.map(prof => {
          const rec = a?.find(x => x.user_id === prof.id && x.date === dateStr);
          const format = (t?: string) => t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-';
          const status = rec?.clock_in ? (rec.clock_out ? (rec.is_auto_checkout ? '자동마감' : '퇴근완료') : '근무중') : '미출근';
          
          return {
            _id: prof.id, _dept: prof.department || '소속 없음',
            '날짜': dateStr, '부서': prof.department || '소속 없음',
            '이름': prof.name, '직급': prof.position || '직급미지정',
            '출근시간': format(rec?.clock_in), '퇴근시간': format(rec?.clock_out),
            '상태': status, '출근기기': rec?.in_device || '-', '퇴근기기': rec?.out_device || '-'
          };
        });

        dailyMerged.sort((x, y) => {
          const deptDiff = (dSorts[x._dept] ?? 99) - (dSorts[y._dept] ?? 99);
          if (deptDiff !== 0) return deptDiff;
          return (eSorts[x._id] ?? 99) - (eSorts[y._id] ?? 99);
        });

        dailyMerged.forEach(item => {
          delete (item as any)._id; delete (item as any)._dept;
          excelData.push(item);
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "출퇴근명부");
      XLSX.writeFile(workbook, `출퇴근명부_${excelStartDate}_${excelEndDate}.xlsx`);
      
      setIsExcelModalOpen(false);
    } catch (e) {
      console.error("엑셀 다운로드 실패:", e);
      alert("엑셀 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const availableDepts = ["전체", ...groupedList.map(g => g.dept)];
  const filteredList = groupedList
    .filter(g => selectedDept === "전체" || g.dept === selectedDept)
    .map(g => ({ dept: g.dept, employees: g.employees.filter(e => e.name.includes(searchTerm) || g.dept.includes(searchTerm)) }))
    .filter(g => g.employees.length > 0);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      
      {/* ⭐️ 엑셀 다운로드 모달 */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-green-600" /> 엑셀 다운로드
              </h3>
              <button onClick={() => setIsExcelModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* 1. 날짜 범위 선택 */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-500"/> 기간 설정</label>
                <div className="flex items-center gap-3">
                  <input type="date" value={excelStartDate} onChange={(e) => setExcelStartDate(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  <span className="text-gray-400">~</span>
                  <input type="date" value={excelEndDate} onChange={(e) => setExcelEndDate(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>

              {/* 2. 대상 직원 선택 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-800 flex items-center gap-2"><CheckSquare className="w-4 h-4 text-gray-500"/> 대상 직원 선택</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-md transition-colors">
                    <input type="checkbox" checked={selectedUserIds.length === allEmployeeIds.length && allEmployeeIds.length > 0} onChange={handleToggleAll} className="rounded text-green-600 focus:ring-green-500 w-4 h-4 cursor-pointer" />
                    <span className="text-gray-600 font-medium select-none">전체 선택</span>
                  </label>
                </div>
                
                <div className="border border-gray-200 rounded-xl max-h-[250px] overflow-y-auto p-3 bg-gray-50/50 space-y-4">
                  {groupedList.map(group => (
                    <div key={group.dept} className="space-y-1.5">
                      <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md inline-block">{group.dept}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {group.employees.map(emp => (
                          <label key={emp.id} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-white rounded-lg cursor-pointer border border-transparent hover:border-gray-200 transition-all">
                            <input type="checkbox" checked={selectedUserIds.includes(emp.id)} onChange={() => handleToggleUser(emp.id)} className="rounded text-green-600 focus:ring-green-500 w-4 h-4 cursor-pointer" />
                            <span className="text-sm text-gray-800 select-none truncate">{emp.name} <span className="text-xs text-gray-400">{emp.position}</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 shrink-0">
              <button onClick={() => setIsExcelModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleExportExcel} disabled={isExporting} className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 flex items-center gap-2">
                {isExporting ? "다운로드 중..." : `선택한 ${selectedUserIds.length}명 다운로드`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[95%] mx-auto space-y-6">
        
        {/* 상단 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Clock className="w-6 h-6 text-blue-600" /> 전체 직원 출퇴근 명부</h1>
              <p className="text-gray-500 text-sm mt-1">팀원들의 당일 출퇴근 현황 및 접속 기기를 확인합니다.</p>
            </div>
          </div>
          <button onClick={openExcelModal} className="flex items-center justify-center gap-2 bg-white border border-green-200 text-green-700 hover:bg-green-50 px-4 py-2.5 rounded-xl shadow-sm font-bold text-sm transition-colors">
            <Download className="w-4 h-4" /> 엑셀 다운로드
          </button>
        </div>

        {/* 필터 영역 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="이름 또는 부서 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          {!isLoading && groupedList.length > 0 && (
            <div className="pt-2 border-t border-gray-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {availableDepts.map(dept => (
                <button key={dept} onClick={() => setSelectedDept(dept)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedDept === dept ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {dept}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 리스트 렌더링 */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">데이터를 불러오는 중입니다...</div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">검색 결과가 없습니다.</div>
        ) : (
          <div className="space-y-8">
            {filteredList.map((group) => (
              <div key={group.dept} className="space-y-3 animate-in fade-in duration-300">
                
                {/* 부서 헤더 */}
                <div className="flex items-center gap-2 px-1">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-gray-800">{group.dept}</h2>
                  <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2.5 py-0.5 rounded-full ml-1">{group.employees.length}명</span>
                </div>

                {/* PC 뷰 테이블 */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                        <th className="p-4 font-semibold w-[200px]">이름 / 직급</th><th className="p-4 font-semibold w-[150px]">출근 시간</th><th className="p-4 font-semibold w-[150px]">출근 기기</th>
                        <th className="p-4 font-semibold w-[150px]">퇴근 시간</th><th className="p-4 font-semibold w-[150px]">퇴근 기기</th><th className="p-4 font-semibold text-center w-[120px]">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.employees.map((emp) => (
                        <tr key={emp.id} onClick={() => router.push(`/attendance/${emp.id}`)} className="hover:bg-blue-50/50 transition-colors cursor-pointer group">
                          <td className="p-4 flex items-center gap-3"><Avatar name={emp.name} /> <div><div className="font-bold text-gray-800">{emp.name}</div><div className="text-xs text-gray-500">{emp.position}</div></div></td>
                          <td className="p-4 text-sm font-medium text-gray-800">{emp.clock_in}</td><td className="p-4">{emp.clock_in !== '-' && <DeviceBadge device={emp.in_device} />}</td>
                          <td className="p-4 text-sm font-medium text-gray-800">{emp.clock_out}</td><td className="p-4">{emp.clock_out !== '-' && <DeviceBadge device={emp.out_device} />}</td>
                          <td className="p-4 text-center"><StatusBadge status={emp.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ⭐️ 에러 수정된 모바일 뷰 리스트 */}
                <div className="block md:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                  {group.employees.map((emp) => (
                    <div key={emp.id} onClick={() => router.push(`/attendance/${emp.id}`)} className="p-4 hover:bg-blue-50/50 transition-colors cursor-pointer active:bg-blue-50 flex flex-col gap-3 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3"><Avatar name={emp.name} /> <div className="font-bold text-gray-800 text-base flex items-center gap-1.5">{emp.name} <span className="text-xs text-gray-500 font-normal">{emp.position}</span></div></div>
                        <StatusBadge status={emp.status} />
                      </div>
                      
                      {/* 👈 map 대신 명시적 블록으로 분리하여 TS 에러 해결 */}
                      <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500 font-medium">출근</span>
                          <div className="font-bold text-gray-800 text-sm">{emp.clock_in}</div>
                          {emp.clock_in !== '-' && <div className="mt-0.5"><DeviceBadge device={emp.in_device} /></div>}
                        </div>
                        <div className="flex flex-col gap-1 border-l border-gray-200 pl-3">
                          <span className="text-xs text-gray-500 font-medium">퇴근</span>
                          <div className="font-bold text-gray-800 text-sm">{emp.clock_out}</div>
                          {emp.clock_out !== '-' && <div className="mt-0.5"><DeviceBadge device={emp.out_device} /></div>}
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
