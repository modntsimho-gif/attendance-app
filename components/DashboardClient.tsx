"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client"; 
import { getMyCurrentYearStats } from "@/app/actions/dashboard"; 
import CalendarView from "@/components/CalendarView";
import LeaveApplicationModal from "@/components/LeaveApplicationModal";
import LeaveHistoryModal from "@/components/LeaveHistoryModal";
import WorkHistoryModal from "@/components/WorkHistoryModal";
import ApprovalModal from "@/components/ApprovalModal";
import OvertimeApplicationModal from "@/components/OvertimeApplicationModal"; 
import TeamListWidget, { Employee } from "@/components/TeamListWidget"; 
import DashboardWidgets from "@/components/DashboardWidgets";
// ⭐️ [NEW] 푸시 알림 매니저 컴포넌트 불러오기 (경로는 실제 파일 위치에 맞게 수정해 주세요)
import PushManager from "@/components/PushManager"; 
import { 
  PlusCircle, Clock, PieChart, Calendar, History, List, Inbox, ChevronRight, UserCog, 
  Settings, Users, AlertTriangle, LogOut, RotateCcw
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

const getLocalToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 📱 [NEW] 접속 기기 판별 함수
const detectDevice = () => {
  if (typeof window === 'undefined') return 'pc';
  const userAgent = navigator.userAgent.toLowerCase();
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    return 'mobile';
  }
  return 'pc';
};

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
  const supabase = createClient(); 
  
  const [displayTotalLeave, setDisplayTotalLeave] = useState(totalLeave);
  const [localLeaveCount, setLocalLeaveCount] = useState(leaveRequestCount);
  const [localOvertimeCount, setLocalOvertimeCount] = useState(overtimeRequestCount);

  const [attendanceStatus, setAttendanceStatus] = useState<'none' | 'checked_in' | 'checked_out'>('none');
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  
  const [autoCheckoutDate, setAutoCheckoutDate] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // 버튼 중복 클릭 방지용 상태

  const currentYear = new Date().getFullYear();

  useEffect(() => { setLocalLeaveCount(leaveRequestCount); }, [leaveRequestCount]);
  useEffect(() => { setLocalOvertimeCount(overtimeRequestCount); }, [overtimeRequestCount]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = getLocalToday();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yYear = yesterday.getFullYear();
        const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yDay = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

        const { data: todayData } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle(); 

        if (todayData) {
          if (todayData.clock_in) {
            setClockInTime(new Date(todayData.clock_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
            setAttendanceStatus(todayData.clock_out ? 'checked_out' : 'checked_in');
          }
          if (todayData.clock_out) {
            setClockOutTime(new Date(todayData.clock_out).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
          }
        }

        const { data: yesterdayData } = await supabase
          .from('attendance')
          .select('is_auto_checkout')
          .eq('user_id', user.id)
          .eq('date', yesterdayStr)
          .maybeSingle();

        if (yesterdayData?.is_auto_checkout) {
          setAutoCheckoutDate(`${yMonth}/${yDay}`);
        }

      } catch (error) {
        console.error("출퇴근 기록을 불러오는데 실패했습니다.", error);
      }
    };
    fetchAttendance();
  }, [supabase]);

  useEffect(() => {
    const fetchLatestStats = async () => {
      try {
        const stats = await getMyCurrentYearStats();
        if (stats && stats.totalLeave !== undefined) {
          setDisplayTotalLeave(stats.totalLeave);
        }
      } catch (e) {
        console.error("연차 정보 업데이트 실패", e);
      }
    };
    fetchLatestStats();
  }, []);

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

  const annualRemaining = displayTotalLeave - usedLeave; 
  const annualRate = calculateRate(displayTotalLeave, usedLeave);
  const annualRateStr = annualRate.toFixed(1); 
  const extraRemaining = extraTotalLeave - extraUsedLeave; 
  const extraRate = calculateRate(extraTotalLeave, extraUsedLeave);
  const extraRateStr = extraRate.toFixed(1);

  const handleLeaveAdded = () => { setLocalLeaveCount((prev) => prev + 1); router.refresh(); };
  const handleLeaveDeleted = () => { setLocalLeaveCount((prev) => Math.max(0, prev - 1)); router.refresh(); };
  const handleOvertimeAdded = () => { setLocalOvertimeCount((prev) => prev + 1); router.refresh(); };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login"); 
      router.refresh();
    } catch (error) {
      console.error("로그아웃 실패:", error);
      alert("로그아웃 중 오류가 발생했습니다.");
    }
  };

  const handleClockIn = async () => {
    try {
      setIsProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("로그인 정보가 없습니다.");

      const currentDevice = detectDevice(); 
      const now = new Date();
      const today = getLocalToday();

      const { error } = await supabase
        .from('attendance')
        .insert([{ 
          user_id: user.id, 
          date: today, 
          clock_in: now.toISOString(),
          in_device: currentDevice 
        }]);

      if (error) throw error;

      setClockInTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      setAttendanceStatus('checked_in');
      alert(`출근 처리가 완료되었습니다. (${currentDevice === 'mobile' ? '모바일' : 'PC'} 접속)`);
    } catch (error) {
      console.error("출근 기록 실패:", error);
      alert("출근 처리에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setIsProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("로그인 정보가 없습니다.");

      const currentDevice = detectDevice(); 
      const now = new Date();
      const today = getLocalToday();

      const { error } = await supabase
        .from('attendance')
        .update({ 
          clock_out: now.toISOString(),
          out_device: currentDevice 
        })
        .eq('user_id', user.id)
        .eq('date', today);

      if (error) throw error;

      setClockOutTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      setAttendanceStatus('checked_out');
      alert(`퇴근 처리가 완료되었습니다. 고생하셨습니다!`);
    } catch (error) {
      console.error("퇴근 기록 실패:", error);
      alert("퇴근 처리에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClockOutCancel = async () => {
    if (!confirm("퇴근 처리를 취소하시겠습니까? 다시 근무 중 상태로 변경됩니다.")) return;

    try {
      setIsProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("로그인 정보가 없습니다.");

      const today = getLocalToday();

      const { error } = await supabase
        .from('attendance')
        .update({ 
            clock_out: null,
            out_device: null 
        }) 
        .eq('user_id', user.id)
        .eq('date', today);

      if (error) throw error;

      setClockOutTime(null); 
      setAttendanceStatus('checked_in'); 
      alert("퇴근이 취소되었습니다.");
    } catch (error) {
      console.error("퇴근 취소 실패:", error);
      alert("퇴근 취소 처리에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <LeaveApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleLeaveAdded} />
      <LeaveHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onDelete={handleLeaveDeleted} />
      <WorkHistoryModal isOpen={isWorkHistoryOpen} onClose={() => setIsWorkHistoryOpen(false)} />
      <ApprovalModal isOpen={isApprovalOpen} onClose={() => setIsApprovalOpen(false)} />
      <OvertimeApplicationModal isOpen={isOvertimeOpen} onClose={() => setIsOvertimeOpen(false)} onSuccess={handleOvertimeAdded} />

      <div className="w-full max-w-[95%] mx-auto space-y-8">
        
        {autoCheckoutDate && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-1.5 bg-orange-100 rounded-full shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-orange-800 text-sm">
                어제({autoCheckoutDate}) 퇴근 기록이 누락되었습니다.
              </h3>
              <p className="text-orange-700 text-sm mt-1">
                시스템에 의해 <strong>18:00로 자동 마감</strong> 처리되었습니다. 실제 퇴근 시간과 다르다면 관리자에게 근태 수정 요청을 진행해 주세요.
              </p>
            </div>
            <button 
              onClick={() => setAutoCheckoutDate(null)}
              className="text-orange-400 hover:text-orange-600 p-1 transition-colors"
            >
              <span className="sr-only">닫기</span>
              ✕
            </button>
          </div>
        )}

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

          <div className="flex items-center gap-3">
            {role === 'manager' && (
              <Link 
                href="/admin"
                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all font-bold text-sm"
              >
                <Settings className="w-4 h-4" />
                관리자 페이지
              </Link>
            )}
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all font-bold text-sm"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          </div>
        </div>

        {/* ⭐️ [NEW] 푸시 알림 설정 배너 추가 */}
        {/* 이미 알림을 허용한 유저에게는 자동으로 숨겨집니다. */}
        <PushManager />

        {/* 상단 통계 (카드 섹션) */}
        <div className="space-y-6">
           {displayTotalLeave === 0 && (
             <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="p-2 bg-amber-100 rounded-full shrink-0">
                 <AlertTriangle className="w-5 h-5 text-amber-600" />
               </div>
               <div>
                 <h3 className="font-bold text-amber-800 text-sm">
                   {currentYear}년도 설정된 기초 연차가 없습니다.
                 </h3>
                 <p className="text-amber-700 text-sm mt-1">
                   현재 할당된 연차가 0일입니다. 관리자에게 <strong>{currentYear}년 연차 설정</strong>을 요청하세요.
                 </p>
               </div>
             </div>
           )}

           {/* 1. 기본 연차 현황 */}
           <div>
            <h3 className="text-gray-700 font-bold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              {currentYear}년 연차 현황
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-medium mb-1">{currentYear}년 총 연차</div>
                <div className={`text-2xl font-bold ${displayTotalLeave === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                  {formatLeave(displayTotalLeave)} <span className="text-sm font-normal text-gray-400">일</span>
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

        {/* 하단 레이아웃 */}
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-4 flex flex-col h-full gap-6 order-2 lg:order-1">
            
            {/* ⭐️ 캘린더 영역: 높이를 대폭 늘리고 내부를 꽉 채우도록 수정했습니다! */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative flex flex-col min-h-[1000px] lg:min-h-[1200px]">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 shrink-0">
                <Clock className="w-5 h-5 text-blue-500" />
                {selectedTeamMember ? `${selectedTeamMember.name}님의 일정 조회` : '근태 캘린더'}
              </h2>
              <div className="flex-1 w-full h-full relative">
                <CalendarView targetUser={selectedTeamMember} />
              </div>
            </div>
            
            <DashboardWidgets />
          </div>

          <div className="lg:col-span-1 space-y-6 order-1 lg:order-2">
            
            {/* 오늘의 출퇴근 위젯 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  오늘의 출퇴근
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">출근 시간</span>
                    <span className={`font-bold ${clockInTime ? 'text-blue-600' : 'text-gray-400'}`}>
                      {clockInTime || '미등록'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">퇴근 시간</span>
                    <span className={`font-bold ${clockOutTime ? 'text-red-500' : 'text-gray-400'}`}>
                      {clockOutTime || '미등록'}
                    </span>
                  </div>
                </div>
                
                {/* 출근 / 퇴근 버튼 */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    onClick={handleClockIn}
                    disabled={attendanceStatus !== 'none' || isProcessing}
                    className={`py-2.5 rounded-lg font-bold text-sm transition-all ${
                      attendanceStatus === 'none' 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing && attendanceStatus === 'none' ? '처리중...' : '출근하기'}
                  </button>
                  
                  {attendanceStatus === 'checked_out' ? (
                    <button 
                      onClick={handleClockOutCancel}
                      disabled={isProcessing}
                      className="py-2.5 rounded-lg font-bold text-sm transition-all bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 shadow-sm flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      퇴근 취소
                    </button>
                  ) : (
                    <button 
                      onClick={handleClockOut}
                      disabled={attendanceStatus !== 'checked_in' || isProcessing}
                      className={`py-2.5 rounded-lg font-bold text-sm transition-all ${
                        attendanceStatus === 'checked_in' 
                          ? 'bg-gray-800 hover:bg-gray-900 text-white shadow-md' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                       {isProcessing && attendanceStatus === 'checked_in' ? '처리중...' : '퇴근하기'}
                    </button>
                  )}
                </div>
                
                <div className="pt-2 border-t border-gray-100 mt-2">
                  <Link 
                    href="/attendance"
                    className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <List className="w-4 h-4 text-gray-500" />
                    전체 직원 출퇴근 명부
                  </Link>
                </div>
              </div>
            </div>

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

            <Link 
              href="/schedule"
              className="w-full bg-white hover:bg-gray-50 p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-gray-800">전체 직원 근태 조회</div>
                  <div className="text-xs text-gray-500">모든 직원의 현황 파악</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </Link>

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
