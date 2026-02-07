"use client";

import { useState } from "react";
import { Search, User, Check } from "lucide-react";

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

  // 검색 필터링 로직 (이름 또는 부서)
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
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
      </div>

      {/* 리스트 영역 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {filteredEmployees.length > 0 ? (
          filteredEmployees.map((emp) => {
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
