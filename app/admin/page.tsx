"use client";

import { useEffect, useState } from "react";
// getHolidays, addHoliday, deleteHoliday 추가 import 확인하세요
import { getEmployees, updateEmployee, getHolidays, addHoliday, deleteHoliday } from "./actions";
import { 
  Loader2, Save, X, Edit, UserCheck, Search, 
  ArrowLeft, Calendar, PieChart, CalendarDays, Trash2, Plus 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

// 타입 정의
type Profile = {
  id: string;
  email: string;
  name: string;
  department: string;
  position: string;
  role: string;
  total_leave_days: number;
  used_leave_days: number;
  extra_leave_days: number;
  extra_used_leave_days: number;
};

type Holiday = {
  id: string;
  date: string;
  title: string;
};

export default function AdminPage() {
  const router = useRouter();
  
  // 탭 상태: 'employees' | 'holidays'
  const [activeTab, setActiveTab] = useState<"employees" | "holidays">("employees");
  
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 직원 수정 상태
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // 공휴일 추가 입력 상태
  const [newHoliday, setNewHoliday] = useState({ date: "", title: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 두 데이터를 병렬로 가져옴
      const [empData, holiData] = await Promise.all([
        getEmployees(),
        getHolidays()
      ]);
      setEmployees(empData || []);
      setHolidays(holiData || []);
    } catch (e) {
      console.error(e);
      // alert("데이터 로딩 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // --- 직원 관리 핸들러 ---
  const handleEdit = (user: Profile) => {
    setEditingUser({
      ...user,
      extra_used_leave_days: user.extra_used_leave_days || 0 
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingUser((prev) => prev ? { ...prev, [name]: value } : null);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    if (!confirm(`${editingUser.name} 님의 정보를 수정하시겠습니까?`)) return;

    const res = await updateEmployee(editingUser.id, editingUser);
    if (res.error) {
      alert("오류: " + res.error);
    } else {
      alert("수정되었습니다.");
      setEditingUser(null);
      loadData();
    }
  };

  // --- 공휴일 관리 핸들러 ---
  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.title) {
      alert("날짜와 공휴일 명을 모두 입력해주세요.");
      return;
    }
    const res = await addHoliday(newHoliday.date, newHoliday.title);
    if (res.success) {
      setNewHoliday({ date: "", title: "" }); // 초기화
      const updated = await getHolidays(); // 목록 갱신
      setHolidays(updated || []);
    } else {
      alert("추가 실패: " + res.error);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await deleteHoliday(id);
    if (res.success) {
      const updated = await getHolidays();
      setHolidays(updated || []);
    } else {
      alert("삭제 실패: " + res.error);
    }
  };

  // 계산 로직
  const calcBasicRemain = (user: Profile) => (Number(user.total_leave_days || 0) - Number(user.used_leave_days || 0)).toFixed(1);
  const calcExtraRemain = (user: Profile) => (Number(user.extra_leave_days || 0) - Number(user.extra_used_leave_days || 0)).toFixed(1);

  const filteredEmployees = employees.filter(emp => 
    emp.name.includes(searchTerm) || emp.department?.includes(searchTerm)
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 헤더 & 탭 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link href="/" className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UserCheck className="text-blue-600" /> 관리자 페이지
            </h1>
          </div>

          {/* 탭 버튼 그룹 */}
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

        {/* ----------------------------------------------------------------------------------
            TAB 1: 직원 관리
           ---------------------------------------------------------------------------------- */}
        {activeTab === "employees" && (
          <>
            {/* 검색바 */}
            <div className="flex justify-end">
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

            {/* 직원 테이블 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs border-b">
                  <tr>
                    <th className="px-6 py-4">이름 / 부서</th>
                    <th className="px-6 py-4 text-center">기본 잔여</th>
                    <th className="px-6 py-4 text-center">연차외 잔여</th>
                    <th className="px-6 py-4 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployees.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{user.name}</div>
                        <div className="text-gray-500 text-xs">{user.department} / {user.position}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-blue-600">
                        {calcBasicRemain(user)}일
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-orange-600">
                        {calcExtraRemain(user)}일
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => handleEdit(user)} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg text-gray-600">
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ----------------------------------------------------------------------------------
            TAB 2: 공휴일 관리
           ---------------------------------------------------------------------------------- */}
        {activeTab === "holidays" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 왼쪽: 공휴일 추가 폼 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-500" /> 공휴일 추가
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">날짜</label>
                  <input 
                    type="date" 
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">공휴일 명칭</label>
                  <input 
                    type="text" 
                    placeholder="예: 창립기념일"
                    value={newHoliday.title}
                    onChange={(e) => setNewHoliday({...newHoliday, title: e.target.value})}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <button 
                  onClick={handleAddHoliday}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> 추가하기
                </button>
              </div>
            </div>

            {/* 오른쪽: 공휴일 목록 리스트 */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> 등록된 공휴일 목록
                </h3>
                <span className="text-xs font-bold bg-white px-2 py-1 rounded border text-gray-500">
                  총 {holidays.length}개
                </span>
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
                            {holiday.date} 
                            <span className="ml-2 text-xs text-gray-400 font-normal">
                              ({format(new Date(holiday.date), "EEE")})
                            </span>
                          </td>
                          <td className="px-6 py-3 text-gray-700">
                            {holiday.title}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button 
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-gray-400">
                          등록된 공휴일이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ⭐️ 직원 수정 모달 (기존 코드 유지) */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="bg-gray-900 p-5 flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">직원 정보 및 연차 수정</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              
              {/* 1. 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">이름</label>
                  <input name="name" value={editingUser.name} onChange={handleChange} className="w-full border rounded-lg p-2 bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">부서</label>
                  <input name="department" value={editingUser.department || ""} onChange={handleChange} className="w-full border rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">직급</label>
                  <input name="position" value={editingUser.position || ""} onChange={handleChange} className="w-full border rounded-lg p-2" />
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

              {/* 2. 연차 데이터 수정 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h3 className="text-blue-800 font-bold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> 기본 연차 현황
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-700 mb-1">총 연차 (발생)</label>
                      <input type="number" name="total_leave_days" value={editingUser.total_leave_days} onChange={handleChange} className="w-full border border-blue-200 rounded-lg p-2 text-right font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-700 mb-1">사용 연차</label>
                      <input type="number" name="used_leave_days" value={editingUser.used_leave_days} onChange={handleChange} className="w-full border border-blue-200 rounded-lg p-2 text-right font-medium" />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                      <span className="text-sm font-bold text-blue-900">잔여 연차</span>
                      <span className="text-xl font-bold text-blue-700">{calcBasicRemain(editingUser)} 일</span>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                  <h3 className="text-orange-800 font-bold mb-3 flex items-center gap-2">
                    <PieChart className="w-4 h-4" /> 연차 외 휴가 현황
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-orange-700 mb-1">총 발생 (보상/대체)</label>
                      <input type="number" name="extra_leave_days" value={editingUser.extra_leave_days} onChange={handleChange} className="w-full border border-orange-200 rounded-lg p-2 text-right font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-orange-700 mb-1">사용 (보상/대체)</label>
                      <input type="number" name="extra_used_leave_days" value={editingUser.extra_used_leave_days} onChange={handleChange} className="w-full border border-orange-200 rounded-lg p-2 text-right font-medium" />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-orange-200">
                      <span className="text-sm font-bold text-orange-900">잔여 (연차 외)</span>
                      <span className="text-xl font-bold text-orange-700">{calcExtraRemain(editingUser)} 일</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 bg-gray-50 border-t flex justify-end gap-3">
              <button onClick={() => setEditingUser(null)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-sm">취소</button>
              <button onClick={handleSave} className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-bold text-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> 저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
