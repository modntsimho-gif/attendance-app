"use client";

import { useState } from "react";
import CalendarView from "@/components/CalendarView";
import LeaveApplicationModal from "@/components/LeaveApplicationModal";
import LeaveHistoryModal from "@/components/LeaveHistoryModal";
import WorkHistoryModal from "@/components/WorkHistoryModal";
import ApprovalModal from "@/components/ApprovalModal";
import TeamListWidget from "@/components/TeamListWidget";
import DashboardWidgets from "@/components/DashboardWidgets"; // 1. import 추가
import { PlusCircle, Clock, FileText, PieChart, Calendar, History, List, Inbox, ChevronRight, UserCog } from "lucide-react";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWorkHistoryOpen, setIsWorkHistoryOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState<any>(null);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      
      {/* 모달들 */}
      <LeaveApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <LeaveHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <WorkHistoryModal isOpen={isWorkHistoryOpen} onClose={() => setIsWorkHistoryOpen(false)} />
      <ApprovalModal isOpen={isApprovalOpen} onClose={() => setIsApprovalOpen(false)} />

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 상단 통계 (기존 유지) */}
        <div className="space-y-6">
           <div>
            <h3 className="text-gray-700 font-bold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              기본 연차 현황
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">총 연차</div>
                <div className="text-2xl font-bold text-gray-800">15.0 <span className="text-sm font-normal text-gray-400">일</span></div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">사용 연차</div>
                <div className="text-2xl font-bold text-blue-600">3.5 <span className="text-sm font-normal text-gray-400">일</span></div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">잔여 연차</div>
                <div className="text-2xl font-bold text-green-600">11.5 <span className="text-sm font-normal text-gray-400">일</span></div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="text-gray-500 text-xs font-medium mb-1">연차 사용률</div>
                <div className="flex items-end gap-2">
                  <div className="text-2xl font-bold text-purple-600">23.3<span className="text-sm">%</span></div>
                </div>
                <div className="w-full bg-gray-100 h-1.5 mt-3 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: '23.3%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-gray-700 font-bold mb-3 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-orange-500" />
              연차 외 휴가 현황
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">총 부여</div>
                <div className="text-2xl font-bold text-gray-800">5.0 <span className="text-sm font-normal text-gray-400">일</span></div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">사용</div>
                <div className="text-2xl font-bold text-orange-600">1.0 <span className="text-sm font-normal text-gray-400">일</span></div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">잔여</div>
                <div className="text-2xl font-bold text-gray-800">4.0 <span className="text-sm font-normal text-gray-400">일</span></div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">사용률</div>
                <div className="flex items-end gap-2">
                  <div className="text-2xl font-bold text-gray-600">20.0<span className="text-sm">%</span></div>
                </div>
                <div className="w-full bg-gray-100 h-1.5 mt-3 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full" style={{ width: '20%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* 좌측: 달력 + 위젯 (3칸 차지) */}
          <div className="lg:col-span-3 flex flex-col h-full">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                {selectedTeamMember ? '동료 일정 조회' : '근태 캘린더'}
              </h2>
              <CalendarView targetUser={selectedTeamMember} />
            </div>

            {/* 2. 여기에 위젯 추가! */}
            <DashboardWidgets />
          </div>

          {/* 우측: 사이드바 (1칸 차지) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* 관리자 결재함 */}
            <button 
              onClick={() => setIsApprovalOpen(true)}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white p-4 rounded-xl shadow-lg flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg group-hover:bg-gray-600 transition-colors">
                  <Inbox className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold">결재함 열기</div>
                </div>
              </div>
              <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                3
              </div>
            </button>

            {/* 내 근태 관리 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <UserCog className="w-4 h-4 text-gray-500" />
                  내 근태 관리
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {/* 연차 섹션 */}
                <div className="space-y-2">
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-3 rounded-lg font-bold transition-colors"
                  >
                    <span className="flex items-center gap-2"><PlusCircle className="w-4 h-4"/> 연차 신청</span>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                  <button 
                    onClick={() => setIsHistoryOpen(true)}
                    className="w-full flex items-center justify-between text-gray-500 hover:text-gray-800 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-2"><History className="w-4 h-4"/> 신청 내역 조회</span>
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">15건</span>
                  </button>
                </div>

                <div className="h-px bg-gray-100"></div>

                {/* 근무 섹션 */}
                <div className="space-y-2">
                  <button className="w-full flex items-center justify-between bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-3 rounded-lg font-bold transition-colors">
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4"/> 초과근무 신청</span>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                  <button 
                    onClick={() => setIsWorkHistoryOpen(true)}
                    className="w-full flex items-center justify-between text-gray-500 hover:text-gray-800 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-2"><List className="w-4 h-4"/> 초과근무 내역 조회</span>
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">5건</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 팀원 리스트 */}
            <TeamListWidget 
              onSelectUser={setSelectedTeamMember} 
              selectedUser={selectedTeamMember} 
            />

          </div>
        </div>
      </div>
    </main>
  );
}
