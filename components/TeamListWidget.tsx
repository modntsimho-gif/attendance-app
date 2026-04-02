"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, User, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ⭐️ [핵심] 여기서 export를 해줘야 다른 파일(DashboardClient)에서 import 할 수 있습니다.
export interface Employee {
  id: string;
  name: string;
  department?: string;
  position?: string;
  avatar_url?: string;
}

interface TeamListWidgetProps {
  employees: Employee[]; // 부모로부터 받을 전체 직원 리스트
  selectedUser: Employee | null;
  onSelectUser: (user: Employee | null) => void;
}

export default function TeamListWidget({ 
  employees = [], 
  selectedUser, 
  onSelectUser 
}: TeamListWidgetProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("전체"); // ⭐️ 부서 필터 상태 추가
  const supabase = createClient();

  // [State] 정렬 기준 데이터 저장
  const [dSorts, setDSorts] = useState<Record<string, number>>({});
  const [eSorts, setESorts] = useState<Record<string, number>>({});

  // DB에서 정렬 기준(sort_settings) 불러오기
  useEffect(() => {
    const fetchSortSettings = async () => {
      const { data } = await supabase.from('sort_settings').select('*');
      if (data) {
        const ds: Record<string, number> = {};
        const es: Record<string, number> = {};
        data.forEach((s: any) => {
          if (s.target_type === 'department') ds[s.target_id] = s.sort_order;
          if (s.target_type === 'employee') es[s.target_id] = s.sort_order;
        });
        setDSorts(ds);
        setESorts(es);
      }
    };
    fetchSortSettings();
  }, [supabase]);

  // ⭐️ [Logic] 검색, 부서 필터링 및 정렬 통합 적용
  const { availableDepts, sortedAndFilteredEmployees, activeDept } = useMemo(() => {
    // 1. 검색어 필터링 (이름 또는 부서)
    const searchFiltered = employees.filter(emp => 
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // 2. 전체 직원 기준 존재하는 부서 목록 추출 및 정렬 (탭 렌더링용)
    const uniqueDepts = Array.from(new Set(employees.map(emp => emp.department || "소속 없음")));
    const sortedDepts = uniqueDepts.sort((a, b) => (dSorts[a] ?? 999) - (dSorts[b] ?? 999));
    const availableDepts = ["전체", ...sortedDepts];

    // 예외 처리: 선택된 부서가 목록에 없으면 '전체'로 폴백
    const activeDept = availableDepts.includes(selectedDept) ? selectedDept : "전체";

    // 3. 부서 필터링 적용
    const deptFiltered = activeDept === "전체" 
      ? searchFiltered 
      : searchFiltered.filter(emp => (emp.department || "소속 없음") === activeDept);

    // 4. 정렬 적용 (1순위: 부서, 2순위: 직원)
    const finalSorted = deptFiltered.sort((a, b) => {
      const deptA = a.department || "소속 없음";
      const deptB = b.department || "소속 없음";
      
      const dOrderA = dSorts[deptA] ?? 999;
      const dOrderB = dSorts[deptB] ?? 999;
      
      if (dOrderA !== dOrderB) return dOrderA - dOrderB;
      
      const eOrderA = eSorts[a.id] ?? 999;
      const eOrderB = eSorts[b.id] ?? 999;
      
      return eOrderA - eOrderB;
    });

    return { availableDepts, sortedAndFilteredEmployees: finalSorted, activeDept };
  }, [employees, searchTerm, selectedDept, dSorts, eSorts]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-500" />
          직원 목록 ({employees.length})
        </h3>
        
        {/* 검색창 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="이름 또는 부서 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* ⭐️ 부서 필터 탭 (Pill) */}
        {availableDepts.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {availableDepts.map(dept => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  activeDept === dept 
                    ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-200" 
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 리스트 영역 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {sortedAndFilteredEmployees.length > 0 ? (
          sortedAndFilteredEmployees.map((emp) => {
            const isSelected = selectedUser?.id === emp.id;
            
            return (
              <button
                key={emp.id}
                onClick={() => onSelectUser(isSelected ? null : emp)} // 다시 누르면 선택 해제
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left ${
                  isSelected 
                    ? "bg-blue-50 border border-blue-200 shadow-sm" 
                    : "hover:bg-gray-50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* 아바타 (없으면 이니셜) */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    isSelected ? "bg-blue-200 text-blue-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {emp.avatar_url ? (
                      <img src={emp.avatar_url} alt={emp.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      emp.name.slice(0, 1)
                    )}
                  </div>
                  
                  <div className="min-w-0">
                    <div className={`text-sm font-bold truncate ${isSelected ? "text-blue-800" : "text-gray-800"}`}>
                      {emp.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {emp.department || "부서미정"} · {emp.position || "사원"}
                    </div>
                  </div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
              </button>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
            <p>검색 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
