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
import TeamListWidget, { Employee } from "@/components/TeamListWidget"; // Employee 타입 import
import DashboardWidgets from "@/components/DashboardWidgets";
import { 
  PlusCircle, Clock, PieChart, Calendar, History, List, Inbox, ChevronRight, UserCog, 
  Settings, Users 
} from "lucide-react";

interface DashboardClientProps {
  userName: string;
  department: string;
  role?: string;
  
  // [DB: profiles.total_leave_days] 기본 연차 총 개수
  totalLeave: number;
  // [DB: profiles.used_leave_days] 사용한 기본 연차
  usedLeave: number;
  
  // [DB: profiles.extra_leave_days] 발생한 보상휴가 총합
  extraTotalLeave: number;
  // [DB: profiles.extra_used_leave_days] 사용한 보상휴가
  extraUsedLeave: number;
  
  // [카운트]
  leaveRequestCount: number;
  overtimeRequestCount: number;
  pendingApprovalCount: number;

  // [NEW] 전체 직원 리스트 (DB에서 받아옴)
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
  employees = [] // 기본값 설정
}: DashboardClientProps) {
  
  const router = useRouter();
  
  // --- State ---
  const [localLeaveCount, setLocalLeaveCount] = useState(leaveRequestCount);
  const [localOvertimeCount, setLocalOvertimeCount] = useState(overtimeRequestCount);

  useEffect(() => { setLocalLeaveCount(leaveRequestCount); }, [leaveRequestCount]);
  useEffect(() => { setLocalOvertimeCount(overtimeRequestCount); }, [overtimeRequestCount]);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWorkHistoryOpen, setIsWorkHistoryOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isOvertimeOpen, setIsOvertimeOpen] = useState(false);
  
  // 선택된 직원 (캘린더 조회용)
  const [selectedTeamMember, setSelectedTeamMember] = useState<Employee | null>(null);

  // --- [로직] 휴가 계산 및 포맷팅 ---

  // 1. 숫자 포맷팅 (소수점 뒤 불필요한 0 제거)
  const formatLeave = (val: number) => {
    return Number(val.toFixed(2)).toString();
  };

  // 2. 사용률(%) 계산 (0 나누기 방지)
  const calculateRate = (total: number, used: number) => {
    if (total <= 0) return 0;
    const rate = (used / total) * 100;
    return Math.min(100, Math.max(0, rate)); // 0~100 사이로 제한
  };

  // --- [A] 기본 연차 계산 ---
  const annualRemaining = totalLeave - usedLeave; // 잔여 = 총 - 사용
  const annualRate = calculateRate(totalLeave, usedLeave);
  const annualRateStr = annualRate.toFixed(1); // 표시용 문자열

  // --- [B] 연차 외 휴가(보상) 계산 ---
  const extraRemaining = extraTotalLeave - extraUsedLeave; // 잔여 = 발생총합 - 사용
  const extraRate = calculateRate(extraTotalLeave, extraUsedLeave);
  const extraRateStr = extraRate.toFixed(1);

  // --- 핸들러 ---
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
      
      {/* 모달들 */}
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

          {/* 관리자 버튼 */}
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

        {/* 상단 통계 (카드 섹션) */}
        <div className="space-y-6">
           
           {/* 1. 기본 연차 현황 */}
           <div>
            <h3 className="text-gray-700 font-bold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              연차 현황
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 총 연차 */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">총 연차</div>
                <div className="text-2xl font-bold text-gray-800">
                  {formatLeave(totalLeave)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              
              {/* 사용 연차 */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">사용 연차</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatLeave(usedLeave)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              
              {/* 잔여 연차 */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">잔여 연차</div>
                <div className={`text-2xl font-bold ${annualRemaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {formatLeave(annualRemaining)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              
              {/* 사용률 그래프 */}
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
              {/* 발생 총합 */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">총 보상 휴가</div>
                <div className="text-2xl font-bold text-gray-800">
                  {formatLeave(extraTotalLeave)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              
              {/* 사용량 */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">사용</div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatLeave(extraUsedLeave)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              
              {/* 잔여량 */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">잔여</div>
                <div className={`text-2xl font-bold ${extraRemaining < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                  {formatLeave(extraRemaining)} <span className="text-sm font-normal text-gray-400">일</span>
                </div>
              </div>
              
              {/* 사용률 그래프 */}
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

        {/* 메인 컨텐츠 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          <div className="lg:col-span-4 flex flex-col h-full gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                {selectedTeamMember ? `${selectedTeamMember.name}님의 일정 조회` : '근태 캘린더'}
              </h2>
              <CalendarView targetUser={selectedTeamMember} />
            </div>

            <DashboardWidgets />
          </div>

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
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                      {localLeaveCount}건
                    </span>
                  </button>
                </div>

                <div className="h-px bg-gray-100"></div>

                {/* 근무 섹션 */}
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

            {/* [NEW] 업데이트된 위젯: DB 직원 리스트 전달 */}
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
