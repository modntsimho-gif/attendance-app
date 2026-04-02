"use client";

import { useEffect, useState, useRef } from "react";
import { 
  getEmployees, updateEmployee, getHolidays, addHoliday, deleteHoliday,
  getEmployeeAllocations, saveEmployeeAllocation, deleteEmployeeAllocation,
  resetAllUsedLeaveDays, bulkUpsertAllocations, getSortSettings, updateSortSettings
} from "./actions";

import { 
  Loader2, Save, X, Edit, UserCheck, Search, ArrowLeft, CalendarDays, 
  Trash2, Plus, Settings2, UserMinus, RotateCcw, AlertTriangle, Download, 
  Upload, ListOrdered, Building2, GripVertical, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import * as XLSX from "xlsx";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

const DEPARTMENTS = ["CEO", "대외협력팀", "소원사업팀", "경영지원팀"];
const POSITIONS = ["간사", "대리", "과장", "차장", "팀장", "사무총장"];

type Allocation = { id: string; year: number; total_days: number; };
type Profile = {
  id: string; email: string; name: string; department: string | null;
  position: string | null; role: string; join_date: string | null;
  resigned_at: string | null; total_leave_days: number; used_leave_days: number;
  extra_leave_days: number; extra_used_leave_days: number;
  is_approver?: boolean;
  annual_leave_allocations?: Allocation[];
};
type Holiday = { id: string; date: string; title: string; };

export default function AdminPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"employees" | "holidays" | "sort">("employees");
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [modalAllocations, setModalAllocations] = useState<Allocation[]>([]);
  const [newAllocation, setNewAllocation] = useState({ year: new Date().getFullYear(), days: 15 });
  const [allocLoading, setAllocLoading] = useState(false);

  const [newHoliday, setNewHoliday] = useState({ date: "", title: "" });
  const [isResetting, setIsResetting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);

  const [orderedDepts, setOrderedDepts] = useState<string[]>([]);
  const [orderedEmpsByDept, setOrderedEmpsByDept] = useState<Record<string, Profile[]>>({});
  const [isSavingSort, setIsSavingSort] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, holiData, sortData] = await Promise.all([
        getEmployees(), getHolidays(), getSortSettings()
      ]);
      
      const emps = (empData as any) || [];
      setEmployees(emps);
      setHolidays(holiData || []);

      const dSorts: Record<string, number> = {};
      const eSorts: Record<string, number> = {};
      if (sortData) {
        sortData.forEach((s: any) => {
          if (s.target_type === 'department') dSorts[s.target_id] = s.sort_order;
          if (s.target_type === 'employee') eSorts[s.target_id] = s.sort_order;
        });
      }

      const uniqueDepts = Array.from(new Set(emps.map((e: Profile) => e.department || "소속 없음")));
      const sortedDepts = uniqueDepts.sort((a, b) => (dSorts[a as string] ?? 99) - (dSorts[b as string] ?? 99));
      setOrderedDepts(sortedDepts as string[]);

      const empsByDept: Record<string, Profile[]> = {};
      sortedDepts.forEach(dept => {
        const deptEmps = emps.filter((e: Profile) => (e.department || "소속 없음") === dept);
        deptEmps.sort((a: Profile, b: Profile) => (eSorts[a.id] ?? 99) - (eSorts[b.id] ?? 99));
        empsByDept[dept as string] = deptEmps;
      });
      setOrderedEmpsByDept(empsByDept);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;

    if (type === "department") {
      const newDepts = Array.from(orderedDepts);
      const [removed] = newDepts.splice(source.index, 1);
      newDepts.splice(destination.index, 0, removed);
      setOrderedDepts(newDepts);
    } 
    else if (type === "employee") {
      const dept = source.droppableId;
      if (source.droppableId !== destination.droppableId) return;

      const newEmps = Array.from(orderedEmpsByDept[dept]);
      const [removed] = newEmps.splice(source.index, 1);
      newEmps.splice(destination.index, 0, removed);
      
      setOrderedEmpsByDept({ ...orderedEmpsByDept, [dept]: newEmps });
    }
  };

  const handleSaveSortOrders = async () => {
    setIsSavingSort(true);
    try {
      const payload: { target_id: string; target_type: string; sort_order: number }[] = [];
      orderedDepts.forEach((dept, index) => {
        payload.push({ target_id: dept, target_type: 'department', sort_order: index + 1 });
      });
      Object.values(orderedEmpsByDept).forEach(emps => {
        emps.forEach((emp, index) => {
          payload.push({ target_id: emp.id, target_type: 'employee', sort_order: index + 1 });
        });
      });

      const res = await updateSortSettings(payload);
      if (res.success) {
        alert("✅ 드래그한 순서대로 정렬 기준이 저장되었습니다.");
        loadData();
      } else alert("저장 실패: " + res.error);
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsSavingSort(false);
    }
  };

  const handleDownloadExcel = () => { /* 엑셀 다운로드 유지 */ };
  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => { /* 엑셀 업로드 유지 */ };
  const handleResetAllLeaves = async () => { /* 초기화 유지 */ };
  
  const handleEdit = async (user: Profile) => {
    setEditingUser({ ...user });
    setAllocLoading(true);
    const allocs = await getEmployeeAllocations(user.id);
    setModalAllocations(allocs || []);
    setAllocLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    const checked = (e.target as HTMLInputElement).checked;
    
    setEditingUser((prev) => prev ? { 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    } : null);
  };

  const handleSaveProfile = async () => {
    if (!editingUser) return;
    if (!confirm(`${editingUser.name} 님의 정보를 수정하시겠습니까?`)) return;
    const res = await updateEmployee(editingUser.id, editingUser);
    if (res.error) alert("오류: " + res.error); 
    else { alert("저장되었습니다."); setEditingUser(null); loadData(); }
  };

  const handleSaveAllocation = async () => {
    if (!editingUser) return;
    if (!newAllocation.year || !newAllocation.days) return alert("입력해주세요.");
    const res = await saveEmployeeAllocation(editingUser.id, newAllocation.year, newAllocation.days);
    if (res.success) {
      const updated = await getEmployeeAllocations(editingUser.id);
      setModalAllocations(updated || []);
      if (newAllocation.year === new Date().getFullYear()) loadData(); 
      alert("저장되었습니다.");
    } else alert("저장 실패: " + res.error);
  };

  const handleDeleteAllocation = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const res = await deleteEmployeeAllocation(id);
    if (res.success && editingUser) {
      const updated = await getEmployeeAllocations(editingUser.id);
      setModalAllocations(updated || []);
      loadData();
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.title) return alert("입력해주세요.");
    const res = await addHoliday(newHoliday.date, newHoliday.title);
    if (res.success) { setNewHoliday({ date: "", title: "" }); const updated = await getHolidays(); setHolidays(updated || []); }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const res = await deleteHoliday(id);
    if (res.success) { const updated = await getHolidays(); setHolidays(updated || []); }
  };

  if (!isMounted || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  // ⭐️ [변경] 검색 결과가 있는지 확인하기 위한 변수
  const hasSearchResults = orderedDepts.some(dept => {
    const deptEmps = orderedEmpsByDept[dept] || [];
    return deptEmps.some(emp => emp.name.includes(searchTerm) || (emp.department && emp.department.includes(searchTerm)));
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 헤더 및 탭 메뉴 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link href="/" className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-6 h-6 text-gray-600" /></Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><UserCheck className="text-blue-600" /> 관리자 페이지</h1>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto">
            <button onClick={() => setActiveTab("employees")} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === "employees" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><UserCheck className="w-4 h-4" /> 직원 관리</button>
            <button onClick={() => setActiveTab("sort")} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === "sort" ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><ListOrdered className="w-4 h-4" /> 정렬기준 설정</button>
            <button onClick={() => setActiveTab("holidays")} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === "holidays" ? "bg-white text-red-500 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><CalendarDays className="w-4 h-4" /> 공휴일 관리</button>
          </div>
        </div>

        {/* 1. 직원 관리 탭 */}
        {activeTab === "employees" && (
          <>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleDownloadExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-bold hover:bg-green-100 transition-all shadow-sm"><Download className="w-4 h-4" /> 연차 양식 다운로드</button>
                <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleUploadExcel} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isExcelProcessing} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50">
                  {isExcelProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {isExcelProcessing ? "업로드 중..." : "엑셀 일괄 업로드"}
                </button>
                <div className="w-px h-6 bg-gray-300 mx-2 hidden md:block"></div>
                <button onClick={handleResetAllLeaves} disabled={isResetting} className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 hover:border-red-300 transition-all shadow-sm disabled:opacity-50">
                  {isResetting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} 사용일 초기화 (새해용)
                </button>
              </div>
              <div className="relative w-full lg:w-64 shrink-0">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="이름 또는 부서 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-white text-gray-900 shadow-sm" />
              </div>
            </div>

            {/* ⭐️ [변경] 부서별 카드 리스트 형태로 렌더링 */}
            <div className="space-y-6">
              {!hasSearchResults && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-500">
                  검색 결과가 없습니다.
                </div>
              )}

              {orderedDepts.map(dept => {
                const deptEmps = (orderedEmpsByDept[dept] || []).filter(emp => 
                  emp.name.includes(searchTerm) || (emp.department && emp.department.includes(searchTerm))
                );

                if (deptEmps.length === 0) return null;

                return (
                  <div key={dept} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* 부서 헤더 */}
                    <div className="bg-gray-50 px-5 py-3 border-b flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        {dept}
                      </h3>
                      <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border shadow-sm">
                        {deptEmps.length}명
                      </span>
                    </div>

                    {/* 부서 소속 직원 리스트 (모바일 친화적) */}
                    <div className="divide-y divide-gray-100">
                      {deptEmps.map(user => (
                        <div key={user.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors ${user.resigned_at ? "bg-gray-50/50" : ""}`}>
                          
                          {/* 직원 기본 정보 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`font-bold text-base ${user.resigned_at ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                {user.name}
                              </span>
                              <span className="text-sm text-gray-500">{user.position || "-"}</span>
                              
                              {user.resigned_at && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">퇴사</span>
                              )}
                              {user.is_approver && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md">
                                  <CheckCircle2 className="w-3 h-3" /> 결재권자
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 연차 내역 */}
                          <div className="flex-1">
                            <div className="flex flex-wrap gap-1.5">
                              {user.annual_leave_allocations && user.annual_leave_allocations.length > 0 ? (
                                user.annual_leave_allocations.sort((a, b) => b.year - a.year).map((alloc) => (
                                  <span key={alloc.year} className={`px-2 py-1 rounded text-[11px] font-bold border ${alloc.year === new Date().getFullYear() ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                                    {alloc.year}년: {alloc.total_days}개
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 text-xs">설정된 연차 없음</span>
                              )}
                            </div>
                          </div>

                          {/* 관리 버튼 */}
                          <div className="flex justify-end shrink-0">
                            <button 
                              onClick={() => handleEdit(user)} 
                              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 md:px-3 md:py-1.5 rounded-lg text-sm md:text-xs font-bold transition-colors inline-flex items-center gap-1 shadow-sm w-full md:w-auto justify-center"
                            >
                              <Edit className="w-4 h-4 md:w-3 md:h-3" /> 관리
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 2. 정렬기준 설정 탭 (생략 없이 유지) */}
        {activeTab === "sort" && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4 sticky top-4 z-10">
                <div className="text-sm text-gray-600 flex items-center gap-2"><GripVertical className="w-4 h-4 text-gray-400" /><span>좌측의 핸들을 마우스로 끌어서 순서를 변경한 뒤 저장하세요.</span></div>
                <button onClick={handleSaveSortOrders} disabled={isSavingSort} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm disabled:opacity-50 w-full sm:w-auto justify-center">
                  {isSavingSort ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 정렬기준 일괄 저장
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                  <div className="p-4 border-b bg-purple-50 flex items-center gap-2"><Building2 className="w-5 h-5 text-purple-600" /><h3 className="font-bold text-purple-900">부서 노출 순서</h3></div>
                  <Droppable droppableId="departments" type="department">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-gray-100">
                        {orderedDepts.map((dept, index) => (
                          <Draggable key={dept} draggableId={dept} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} className={`flex items-center p-3 bg-white ${snapshot.isDragging ? "shadow-lg ring-2 ring-purple-500 z-50" : "hover:bg-gray-50"}`}>
                                <div {...provided.dragHandleProps} className="p-2 text-gray-400 hover:text-purple-600 cursor-grab active:cursor-grabbing"><GripVertical className="w-5 h-5" /></div>
                                <span className="font-bold text-gray-800 ml-2">{dept}</span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>

                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  {orderedDepts.map(dept => (
                    <div key={dept} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                      <div className="p-3 border-b bg-gray-50 font-bold text-gray-800 flex justify-between items-center">
                        <span>{dept}</span><span className="text-xs text-gray-500 font-normal bg-white px-2 py-1 rounded border shadow-sm">{orderedEmpsByDept[dept]?.length || 0}명</span>
                      </div>
                      <Droppable droppableId={dept} type="employee">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-gray-100 min-h-[50px]">
                            {orderedEmpsByDept[dept]?.map((emp, index) => (
                              <Draggable key={emp.id} draggableId={emp.id} index={index}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.draggableProps} className={`flex items-center p-2 bg-white ${snapshot.isDragging ? "shadow-lg ring-2 ring-purple-500 z-50" : "hover:bg-gray-50"} ${emp.resigned_at ? "opacity-50" : ""}`}>
                                    <div {...provided.dragHandleProps} className="p-1.5 text-gray-300 hover:text-purple-600 cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4" /></div>
                                    <div className="ml-2 flex-1">
                                      <div className="font-medium text-gray-900 text-sm">{emp.name} {emp.resigned_at && <span className="text-[10px] text-red-500 ml-1">(퇴사)</span>}</div>
                                      <div className="text-xs text-gray-500">{emp.position || "-"}</div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DragDropContext>
        )}
        
        {/* 3. 공휴일 관리 탭 (생략 없이 유지) */}
        {activeTab === "holidays" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-red-500" /> 공휴일 추가</h3>
              <div className="space-y-4">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">날짜</label><input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})} className="w-full border rounded-lg p-2 text-sm text-gray-900 bg-white" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">공휴일 명칭</label><input type="text" placeholder="예: 창립기념일" value={newHoliday.title} onChange={(e) => setNewHoliday({...newHoliday, title: e.target.value})} className="w-full border rounded-lg p-2 text-sm text-gray-900 bg-white" /></div>
                <button onClick={handleAddHoliday} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"><Plus className="w-4 h-4" /> 추가하기</button>
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> 등록된 공휴일 목록</h3><span className="text-xs font-bold bg-white px-2 py-1 rounded border text-gray-500">총 {holidays.length}개</span></div>
              <div className="flex-1 overflow-y-auto max-h-[600px] p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 font-bold text-xs border-b sticky top-0"><tr><th className="px-6 py-3">날짜</th><th className="px-6 py-3">명칭</th><th className="px-6 py-3 text-right">삭제</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {holidays.length > 0 ? holidays.map((holiday) => (
                      <tr key={holiday.id} className="hover:bg-gray-50 group">
                        <td className="px-6 py-3 font-medium text-gray-900">{holiday.date} <span className="ml-2 text-xs text-gray-400 font-normal">({format(new Date(holiday.date), "EEE")})</span></td>
                        <td className="px-6 py-3 text-gray-700">{holiday.title}</td>
                        <td className="px-6 py-3 text-right"><button onClick={() => handleDeleteHoliday(holiday.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    )) : <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-400">등록된 공휴일이 없습니다.</td></tr>}
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
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">이름</label><input name="name" value={editingUser.name} onChange={handleChange} className="w-full border rounded-lg p-2 bg-gray-50 text-gray-900" /></div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">부서</label>
                  <select name="department" value={editingUser.department || ""} onChange={handleChange} className="w-full border rounded-lg p-2 text-gray-900 bg-white">
                    <option value="">선택하세요</option>{DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">직급</label>
                  <select name="position" value={editingUser.position || ""} onChange={handleChange} className="w-full border rounded-lg p-2 text-gray-900 bg-white">
                    <option value="">선택하세요</option>{POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">시스템 권한</label>
                  <select name="role" value={editingUser.role} onChange={handleChange} className="w-full border rounded-lg p-2 text-gray-900 bg-white">
                    <option value="employee">일반 직원</option><option value="manager">최고 관리자</option>
                  </select>
                </div>
                
                {/* 결재 권한 토글 스위치 */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1">결재 권한 (승인자)</label>
                  <div className="flex items-center h-[38px] px-3 border rounded-lg bg-white">
                    <label className="flex items-center gap-2 cursor-pointer w-full">
                      <input 
                        type="checkbox" 
                        name="is_approver" 
                        checked={!!editingUser.is_approver} 
                        onChange={handleChange}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-900 font-medium">결재권한 부여</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-100"></div>

              {/* 연차 설정 영역 */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="text-blue-800 font-bold mb-3 flex items-center gap-2"><Settings2 className="w-4 h-4" /> 연도별 기초 연차(발생) 설정</h3>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1"><input type="number" placeholder="연도 (예: 2025)" value={newAllocation.year} onChange={(e) => setNewAllocation({...newAllocation, year: parseInt(e.target.value)})} className="w-full border border-blue-200 rounded-lg p-2 text-sm text-gray-900 bg-white" /></div>
                  <div className="flex-1"><input type="number" placeholder="총 연차 (일)" value={newAllocation.days} onChange={(e) => setNewAllocation({...newAllocation, days: parseFloat(e.target.value)})} className="w-full border border-blue-200 rounded-lg p-2 text-sm text-gray-900 bg-white" /></div>
                  <button onClick={handleSaveAllocation} className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-lg font-bold text-sm whitespace-nowrap">설정</button>
                </div>

                <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                  {allocLoading ? <div className="p-4 text-center text-xs text-gray-400">불러오는 중...</div> : modalAllocations.length === 0 ? <div className="p-4 text-center text-xs text-gray-400">설정된 연차 정보가 없습니다.</div> : (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-blue-50/50 text-blue-800 text-xs font-bold"><tr><th className="px-4 py-2">연도</th><th className="px-4 py-2">총 발생 연차</th><th className="px-4 py-2 text-right">삭제</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {modalAllocations.map((alloc) => (
                          <tr key={alloc.id}>
                            <td className="px-4 py-2 font-medium">{alloc.year}년</td><td className="px-4 py-2 font-bold text-blue-600">{alloc.total_days}일</td>
                            <td className="px-4 py-2 text-right"><button onClick={() => handleDeleteAllocation(alloc.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* 퇴사 처리 영역 */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <h3 className="text-red-800 font-bold mb-3 flex items-center gap-2"><UserMinus className="w-4 h-4" /> 퇴사 처리 (Danger Zone)</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-red-600 mb-1">퇴사일자</label>
                    <input type="date" name="resigned_at" value={editingUser.resigned_at || ""} onChange={handleChange} className="w-full border border-red-200 rounded-lg p-2 text-sm focus:ring-red-500 text-gray-900 bg-white" />
                    <p className="text-[10px] text-red-500 mt-1">* 퇴사일을 입력하고 저장하면 퇴사 처리됩니다. (복구하려면 날짜를 지우세요)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 bg-gray-50 border-t flex justify-end gap-3">
              <button onClick={() => setEditingUser(null)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-sm">취소</button>
              <button onClick={handleSaveProfile} className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-bold text-sm flex items-center gap-2"><Save className="w-4 h-4" /> 정보 저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
