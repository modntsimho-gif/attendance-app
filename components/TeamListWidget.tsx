"use client";

import { Users, Search, Circle } from "lucide-react";

interface TeamListWidgetProps {
  onSelectUser: (user: any) => void;
  selectedUser: any;
}

// 가짜 팀원 데이터
const teamMembers = [
  { id: 'me', name: '나 (Me)', role: 'Product Owner', status: 'online', avatar: 'bg-blue-600' },
  { id: 'kim', name: '김토스', role: 'Frontend Dev', status: 'online', avatar: 'bg-emerald-500' },
  { id: 'lee', name: '이디자', role: 'Product Designer', status: 'away', avatar: 'bg-purple-500' },
  { id: 'park', name: '박백엔', role: 'Backend Dev', status: 'offline', avatar: 'bg-orange-500' },
];

export default function TeamListWidget({ onSelectUser, selectedUser }: TeamListWidgetProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full max-h-[400px]">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          팀원 일정 조회
        </h3>
        {/* 검색창 (장식용) */}
        <div className="mt-3 relative">
          <input 
            type="text" 
            placeholder="이름 검색..." 
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:border-blue-300 transition-colors"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
        </div>
      </div>

      {/* 리스트 */}
      <div className="overflow-y-auto p-2 space-y-1">
        {teamMembers.map((member) => {
          const isSelected = selectedUser?.id === member.id || (member.id === 'me' && !selectedUser);
          
          return (
            <button
              key={member.id}
              onClick={() => onSelectUser(member.id === 'me' ? null : member)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                isSelected 
                  ? 'bg-blue-50 border border-blue-100 shadow-sm' 
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              {/* 아바타 */}
              <div className={`w-9 h-9 rounded-full ${member.avatar} flex items-center justify-center text-white text-xs font-bold relative`}>
                {member.name[0]}
                {/* 상태 표시 점 */}
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                  member.status === 'online' ? 'bg-green-400' : 
                  member.status === 'away' ? 'bg-yellow-400' : 'bg-gray-300'
                }`}></span>
              </div>

              {/* 정보 */}
              <div className="text-left flex-1">
                <div className={`text-sm ${isSelected ? 'font-bold text-blue-700' : 'font-medium text-gray-700'}`}>
                  {member.name}
                </div>
                <div className="text-[10px] text-gray-400">
                  {member.role}
                </div>
              </div>

              {/* 선택 표시 */}
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1"></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
