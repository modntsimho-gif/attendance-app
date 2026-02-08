"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CalendarView from "@/components/CalendarView";
import LeaveApplicationModal from "@/components/LeaveApplicationModal";
import LeaveHistoryModal from "@/components/LeaveHistoryModal";
import WorkHistoryModal from "@/components/WorkHistoryModal";
import ApprovalModal from "@/components/ApprovalModal";
import OvertimeApplicationModal from "@/components/OvertimeApplicationModal"; 
import TeamListWidget, { Employee } from "@/components/TeamListWidget"; 
import DashboardWidgets from "@/components/DashboardWidgets";
import { 
  PlusCircle, Clock, PieChart, Calendar, History, List, Inbox, ChevronRight, UserCog, 
  Settings, Users 
} from "lucide-react";

interface DashboardClientProps {
  userName: string;
  department: string;
  role?: string;
  totalLeave: number;
  usedLeave: number;
  extraTotalLeave: number;
  extraUsedLeave: number;
  leaveRequestCount: number;
  overtimeRequestCount: number;
  pendingApprovalCount: number;
  employees: Employee[];
}

export default function DashboardClient({ 
  userName, 
  department,
  role,
  totalLeave = 0, 
  usedLeave = 0,
  extraTotalLeave = 0,
  extraUsedLeave = 0,
  leaveRequestCount,
  overtimeRequestCount,
  pendingApprovalCount,
  employees = [] 
}: DashboardClientProps) {
  
  const router = useRouter();
  
  const [localLeaveCount, setLocalLeaveCount] = useState(leaveRequestCount);
  const [localOvertimeCount, setLocalOvertimeCount] = useState(overtimeRequestCount);

  useEffect(() => { setLocalLeaveCount(leaveRequestCount); }, [leaveRequestCount]);
  useEffect(() => { setLocalOvertimeCount(overtimeRequestCount); }, [overtimeRequestCount]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWorkHistoryOpen, setIsWorkHistoryOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isOvertimeOpen, setIsOvertimeOpen] = useState(false);
  
  const [selectedTeamMember, setSelectedTeamMember] = useState<Employee | null>(null);

  const formatLeave = (val: number) => Number(val.toFixed(2)).toString();

  const calculateRate = (total: number, used: number) => {
    if (total <= 0) return 0;
    const rate = (used / total) * 100;
    return Math.min(100, Math.max(0, rate)); 
  };

  const annualRemaining = totalLeave - usedLeave; 
  const annualRate = calculateRate(totalLeave, usedLeave);
  const annualRateStr = annualRate.toFixed(1); 

  const extraRemaining = extraTotalLeave - extraUsedLeave; 
  const extraRate = calculateRate(extraTotalLeave, extraUsedLeave);
  const extraRateStr = extraRate.toFixed(1);

  const handleLeaveAdded = () => {
    setLocalLeaveCount((prev) => prev + 1); 
    router.refresh(); 
  };

  const handleLeaveDeleted = () => {
    setLocalLeaveCount((prev) => Math.max(0, prev - 1)); 
    router.refresh(); 
  };

  const handleOvertimeAdded = () => {
    setLocalOvertimeCount((prev) => prev + 1); 
    router.refresh(); 
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      
      <LeaveApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleLeaveAdded} />
      <LeaveHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onDelete={handleLeaveDeleted} />
      <WorkHistoryModal isOpen={isWorkHistoryOpen} onClose={() => setIsWorkHistoryOpen(false)} />
      <ApprovalModal isOpen={isApprovalOpen} onClose={() => setIsApprovalOpen(false)} />
      <OvertimeApplicationModal isOpen={isOvertimeOpen} onClose={() => setIsOvertimeOpen(false)} onSuccess={handleOvertimeAdded} />

      <div className="w-full max-w-[95%] mx-auto space-y-8">
        
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              안녕하세요, {userName}님! 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {department} | 오늘도 좋은 하루 되세요.
            </p>
          </div>

          {role === 'manager' && (
            <Link 
              href="/admin"
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all font-bold text-sm"
            >
              <Settings className="w-4 h-4" />
              관리자 페이지
            </Link>
          )}
        </div>

        {/* 상단 통계 (카드 섹션) - 항상 최상단 유지 */}
        <div className="space-y-6">
           {/* 1. 기본 연차 현황 */}
           <div>
            <h3 className="text-gray-700 font-bold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              연차 현황
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">총 연차</div>
                <div className="text-2xl font-bold text-gray-800">
                  {formatLeave(totalLeave)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">사용 연차</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatLeave(usedLeave)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">잔여 연차</div>
                <div className={`text-2xl font-bold ${annualRemaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {formatLeave(annualRemaining)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="text-gray-500 text-xs font-medium mb-1">연차 소진율</div>
                  <div className="flex items-end gap-2">
                    <div className="text-2xl font-bold text-purple-600">{annualRateStr}<span className="text-sm">%</span></div>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-1.5 mt-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-purple-500 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${annualRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 연차 외 휴가 (보상/대체) 현황 */}
          <div>
            <h3 className="text-gray-700 font-bold mb-3 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-orange-500" />
              연차 외 휴가 현황
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">총 보상 휴가</div>
                <div className="text-2xl font-bold text-gray-800">
                  {formatLeave(extraTotalLeave)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">사용</div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatLeave(extraUsedLeave)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">잔여</div>
                <div className={`text-2xl font-bold ${extraRemaining < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                  {formatLeave(extraRemaining)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="text-gray-500 text-xs font-medium mb-1">보상휴가 사용률</div>
                  <div className="flex items-end gap-2">
                    <div className="text-2xl font-bold text-gray-600">{extraRateStr}<span className="text-sm">%</span></div>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-1.5 mt-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-orange-500 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${extraRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 
          ⭐️ [LAYOUT CHANGE] 
          Mobile: flex-col (세로 배치)
          Desktop: grid (기존 유지)
        */}
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-6">
          
          {/* 
            ⭐️ [LEFT COLUMN] 캘린더 & 위젯 
            Mobile: order-2 (버튼들 아래로 내림)
            Desktop: order-1 (왼쪽에 배치, 기존 유지)
          */}
          <div className="lg:col-span-4 flex flex-col h-full gap-6 order-2 lg:order-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                {selectedTeamMember ? `${selectedTeamMember.name}님의 일정 조회` : '근태 캘린더'}
              </h2>
              <CalendarView targetUser={selectedTeamMember} />
            </div>

            <DashboardWidgets />
          </div>

          {/* 
            ⭐️ [RIGHT COLUMN] 버튼 & 직원 리스트
            Mobile: order-1 (캘린더 위로 올림)
            Desktop: order-2 (오른쪽에 배치, 기존 유지)
          */}
          <div className="lg:col-span-1 space-y-6 order-1 lg:order-2">
            
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
              
              {pendingApprovalCount > 0 && (
                <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                  {pendingApprovalCount}
                </div>
              )}
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
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                      {localLeaveCount}건
                    </span>
                  </button>
                </div>

                <div className="h-px bg-gray-100"></div>

                <div className="space-y-2">
                  <button 
                    onClick={() => setIsOvertimeOpen(true)}
                    className="w-full flex items-center justify-between bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-3 rounded-lg font-bold transition-colors"
                  >
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4"/> 초과근무 신청</span>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                  <button 
                    onClick={() => setIsWorkHistoryOpen(true)}
                    className="w-full flex items-center justify-between text-gray-500 hover:text-gray-800 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-2"><List className="w-4 h-4"/> 초과근무 내역 조회</span>
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                      {localOvertimeCount}건
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* 전체 근태 조회 버튼 */}
            <Link 
              href="/schedule"
              className="w-full bg-white hover:bg-gray-50 p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-gray-800">전체 근태 조회</div>
                  <div className="text-xs text-gray-500">모든 직원의 현황 파악</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </Link>

            {/* 직원 리스트 위젯 */}
            <TeamListWidget 
              employees={employees} 
              onSelectUser={setSelectedTeamMember} 
              selectedUser={selectedTeamMember} 
            />

          </div>
        </div>
      </div>
    </main>
  );
}
