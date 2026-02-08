"use client";

import { useEffect, useState } from "react";
// ⭐️ [수정됨] 모든 액션을 "./actions"에서 한 번에 가져옵니다.
import { 
  getEmployees, 
  updateEmployee, 
  getHolidays, 
  addHoliday, 
  deleteHoliday,
  getEmployeeAllocations, 
  saveEmployeeAllocation, 
  deleteEmployeeAllocation,
  resetAllUsedLeaveDays // 👈 여기에 추가했습니다.
} from "./actions";

import { 
  Loader2, Save, X, Edit, UserCheck, Search, 
  ArrowLeft, CalendarDays, Trash2, Plus, Settings2, UserMinus,
  RotateCcw, AlertTriangle 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

const DEPARTMENTS = ["CEO", "대외협력팀", "소원사업팀", "경영지원팀"];
const POSITIONS = ["간사", "대리", "과장", "차장", "팀장", "사무총장"];

type Allocation = {
  id: string;
  year: number;
  total_days: number;
};

type Profile = {
  id: string;
  email: string;
  name: string;
  department: string | null;
  position: string | null;
  role: string;
  join_date: string | null;
  resigned_at: string | null;
  total_leave_days: number;
  used_leave_days: number;
  extra_leave_days: number;
  extra_used_leave_days: number;
  annual_leave_allocations?: Allocation[];
};

type Holiday = {
  id: string;
  date: string;
  title: string;
};

export default function AdminPage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<"employees" | "holidays">("employees");
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [modalAllocations, setModalAllocations] = useState<Allocation[]>([]);
  const [newAllocation, setNewAllocation] = useState({ year: new Date().getFullYear(), days: 15 });
  const [allocLoading, setAllocLoading] = useState(false);

  const [newHoliday, setNewHoliday] = useState({ date: "", title: "" });

  // ⭐️ 초기화 로딩 상태
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, holiData] = await Promise.all([
        getEmployees(),
        getHolidays()
      ]);
      setEmployees((empData as any) || []);
      setHolidays(holiData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ⭐️ 연차 초기화 핸들러
  const handleResetAllLeaves = async () => {
    const confirmed = confirm(
      "⚠️ [주의] 모든 직원의 '연차 사용일(used_leave_days)'을 0으로 초기화하시겠습니까?\n\n" +
      "• 이 작업은 되돌릴 수 없습니다.\n" +
      "• 주로 새해(1월 1일)에 작년 사용 기록을 리셋할 때 사용합니다."
    );

    if (!confirmed) return;

    setIsResetting(true);
    try {
      const res = await resetAllUsedLeaveDays();
      if (res.error) {
        alert("실패: " + res.error);
      } else {
        alert("✅ 모든 직원의 연차 사용일이 0으로 초기화되었습니다.");
        loadData(); // 데이터 새로고침
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleEdit = async (user: Profile) => {
    setEditingUser({ ...user });
    
    setAllocLoading(true);
    const allocs = await getEmployeeAllocations(user.id);
    setModalAllocations(allocs || []);
    setAllocLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingUser((prev) => prev ? { ...prev, [name]: value } : null);
  };

  const handleSaveProfile = async () => {
    if (!editingUser) return;
    
    const confirmMsg = editingUser.resigned_at 
      ? `${editingUser.name} 님을 퇴사 처리(또는 정보 수정) 하시겠습니까?\n퇴사일: ${editingUser.resigned_at}`
      : `${editingUser.name} 님의 기본 정보를 수정하시겠습니까?`;

    if (!confirm(confirmMsg)) return;

    const res = await updateEmployee(editingUser.id, editingUser);
    if (res.error) {
      alert("오류: " + res.error);
    } else {
      alert("저장되었습니다.");
      setEditingUser(null);
      loadData();
    }
  };

  const handleSaveAllocation = async () => {
    if (!editingUser) return;
    if (!newAllocation.year || !newAllocation.days) return alert("연도와 일수를 입력해주세요.");

    const res = await saveEmployeeAllocation(editingUser.id, newAllocation.year, newAllocation.days);
    if (res.success) {
      const updated = await getEmployeeAllocations(editingUser.id);
      setModalAllocations(updated || []);
      
      if (newAllocation.year === new Date().getFullYear()) {
         loadData(); 
      }
      alert("저장되었습니다.");
    } else {
      alert("저장 실패: " + res.error);
    }
  };

  const handleDeleteAllocation = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const res = await deleteEmployeeAllocation(id);
    if (res.success) {
      if (editingUser) {
        const updated = await getEmployeeAllocations(editingUser.id);
        setModalAllocations(updated || []);
        loadData();
      }
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.title) return alert("입력해주세요.");
    const res = await addHoliday(newHoliday.date, newHoliday.title);
    if (res.success) {
      setNewHoliday({ date: "", title: "" }); 
      const updated = await getHolidays(); 
      setHolidays(updated || []);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const res = await deleteHoliday(id);
    if (res.success) {
      const updated = await getHolidays();
      setHolidays(updated || []);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.includes(searchTerm) || (emp.department && emp.department.includes(searchTerm))
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 헤더 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link href="/" className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UserCheck className="text-blue-600" /> 관리자 페이지
            </h1>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab("employees")}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === "employees" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <UserCheck className="w-4 h-4" /> 직원 관리
            </button>
            <button 
              onClick={() => setActiveTab("holidays")}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === "holidays" ? "bg-white text-red-500 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <CalendarDays className="w-4 h-4" /> 공휴일 관리
            </button>
          </div>
        </div>

        {/* 직원 관리 탭 */}
        {activeTab === "employees" && (
          <>
            {/* ⭐️ 검색창 및 초기화 버튼 영역 */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              
              {/* ⭐️ 연차 초기화 버튼 */}
              <button
                onClick={handleResetAllLeaves}
                disabled={isResetting}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 hover:border-red-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? (
                  <RotateCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {isResetting ? "초기화 중..." : "전직원 연차 사용일 초기화 (새해용)"}
              </button>

              {/* 검색창 */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="이름 또는 부서 검색..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-white shadow-sm"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs border-b">
                  <tr>
                    <th className="px-6 py-4">이름 / 부서</th>
                    <th className="px-6 py-4">연도별 기초 연차 내역</th>
                    <th className="px-6 py-4 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployees.map((user) => (
                    <tr key={user.id} className={`hover:bg-gray-50 ${user.resigned_at ? "bg-gray-100/50" : ""}`}>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className={`font-bold text-base ${user.resigned_at ? "text-gray-400 line-through" : "text-gray-900"}`}>
                            {user.name}
                          </div>
                          {user.resigned_at && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">
                              퇴사 ({user.resigned_at})
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5">{user.department} / {user.position}</div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {user.annual_leave_allocations && user.annual_leave_allocations.length > 0 ? (
                            user.annual_leave_allocations
                              .sort((a, b) => b.year - a.year)
                              .map((alloc) => (
                                <span 
                                  key={alloc.year} 
                                  className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                                    alloc.year === new Date().getFullYear() 
                                      ? "bg-blue-50 text-blue-700 border-blue-100" 
                                      : "bg-gray-50 text-gray-600 border-gray-200"
                                  }`}
                                >
                                  {alloc.year}년: {alloc.total_days}개
                                </span>
                              ))
                          ) : (
                            <span className="text-gray-400 text-xs">설정된 내역 없음</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center align-middle">
                        <button 
                          onClick={() => handleEdit(user)} 
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" /> 수정 / 설정
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 공휴일 관리 탭 */}
        {activeTab === "holidays" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-500" /> 공휴일 추가
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">날짜</label>
                  <input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">공휴일 명칭</label>
                  <input type="text" placeholder="예: 창립기념일" value={newHoliday.title} onChange={(e) => setNewHoliday({...newHoliday, title: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <button onClick={handleAddHoliday} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                  <Plus className="w-4 h-4" /> 추가하기
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> 등록된 공휴일 목록
                </h3>
                <span className="text-xs font-bold bg-white px-2 py-1 rounded border text-gray-500">총 {holidays.length}개</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[600px] p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 font-bold text-xs border-b sticky top-0">
                    <tr>
                      <th className="px-6 py-3">날짜</th>
                      <th className="px-6 py-3">명칭</th>
                      <th className="px-6 py-3 text-right">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {holidays.length > 0 ? (
                      holidays.map((holiday) => (
                        <tr key={holiday.id} className="hover:bg-gray-50 group">
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {holiday.date} <span className="ml-2 text-xs text-gray-400 font-normal">({format(new Date(holiday.date), "EEE")})</span>
                          </td>
                          <td className="px-6 py-3 text-gray-700">{holiday.title}</td>
                          <td className="px-6 py-3 text-right">
                            <button onClick={() => handleDeleteHoliday(holiday.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-400">등록된 공휴일이 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 직원 수정 모달 */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="bg-gray-900 p-5 flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">직원 정보 및 연차 설정</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">이름</label>
                  <input name="name" value={editingUser.name} onChange={handleChange} className="w-full border rounded-lg p-2 bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">부서</label>
                  <select name="department" value={editingUser.department || ""} onChange={handleChange} className="w-full border rounded-lg p-2">
                    <option value="">선택하세요</option>
                    {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">직급</label>
                  <select name="position" value={editingUser.position || ""} onChange={handleChange} className="w-full border rounded-lg p-2">
                    <option value="">선택하세요</option>
                    {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">권한</label>
                  <select name="role" value={editingUser.role} onChange={handleChange} className="w-full border rounded-lg p-2">
                    <option value="employee">직원</option>
                    <option value="manager">관리자</option>
                  </select>
                </div>
              </div>

              <div className="h-px bg-gray-100"></div>

              {/* 연차 설정 영역 */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="text-blue-800 font-bold mb-3 flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> 연도별 기초 연차(발생) 설정
                </h3>
                
                <div className="flex gap-2 mb-4">
                  <div className="flex-1">
                    <input 
                      type="number" 
                      placeholder="연도 (예: 2025)"
                      value={newAllocation.year}
                      onChange={(e) => setNewAllocation({...newAllocation, year: parseInt(e.target.value)})}
                      className="w-full border border-blue-200 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                     <input 
                      type="number" 
                      placeholder="총 연차 (일)"
                      value={newAllocation.days}
                      onChange={(e) => setNewAllocation({...newAllocation, days: parseFloat(e.target.value)})}
                      className="w-full border border-blue-200 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <button 
                    onClick={handleSaveAllocation}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-lg font-bold text-sm whitespace-nowrap"
                  >
                    설정
                  </button>
                </div>

                <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                  {allocLoading ? (
                    <div className="p-4 text-center text-xs text-gray-400">불러오는 중...</div>
                  ) : modalAllocations.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">설정된 연차 정보가 없습니다.</div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-blue-50/50 text-blue-800 text-xs font-bold">
                        <tr>
                          <th className="px-4 py-2">연도</th>
                          <th className="px-4 py-2">총 발생 연차</th>
                          <th className="px-4 py-2 text-right">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {modalAllocations.map((alloc) => (
                          <tr key={alloc.id}>
                            <td className="px-4 py-2 font-medium">{alloc.year}년</td>
                            <td className="px-4 py-2 font-bold text-blue-600">{alloc.total_days}일</td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => handleDeleteAllocation(alloc.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* ⭐️ 퇴사 처리 영역 (Danger Zone) */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <h3 className="text-red-800 font-bold mb-3 flex items-center gap-2">
                  <UserMinus className="w-4 h-4" /> 퇴사 처리 (Danger Zone)
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-red-600 mb-1">퇴사일자</label>
                    <input 
                      type="date" 
                      name="resigned_at"
                      value={editingUser.resigned_at || ""}
                      onChange={handleChange}
                      className="w-full border border-red-200 rounded-lg p-2 text-sm focus:ring-red-500"
                    />
                    <p className="text-[10px] text-red-500 mt-1">
                      * 퇴사일을 입력하고 저장하면 퇴사 처리됩니다. (복구하려면 날짜를 지우세요)
                    </p>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-5 bg-gray-50 border-t flex justify-end gap-3">
              <button onClick={() => setEditingUser(null)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-sm">취소</button>
              <button onClick={handleSaveProfile} className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-bold text-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> 정보 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
