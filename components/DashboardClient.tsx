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
import PushManager from "@/components/PushManager"; 
import { 
  PlusCircle, Clock, PieChart, Calendar, History, List, Inbox, ChevronRight, 
  UserCog, Settings, Users, AlertTriangle, LogOut, RotateCcw, RefreshCw 
} from "lucide-react";

interface DashboardClientProps {
  userName: string; department: string; role?: string;
  totalLeave: number; usedLeave: number;
  extraTotalLeave: number; extraUsedLeave: number;
  leaveRequestCount: number; overtimeRequestCount: number; pendingApprovalCount: number;
  employees: Employee[];
}

const getDateStr = (offset = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const detectDevice = () => typeof window !== 'undefined' && /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()) ? 'mobile' : 'pc';
const format = (v: number) => Number(v.toFixed(2)).toString();
const calcRate = (t: number, u: number) => t <= 0 ? 0 : Math.min(100, Math.max(0, (u / t) * 100));

const StatBox = ({ label, val, valColor, isRate = false, rateVal = 0, barColor = "" }: any) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden">
    <div>
      <div className="text-gray-500 text-xs font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold flex items-end gap-2 ${valColor}`}>
        {val} <span className="text-sm font-normal text-gray-400">{isRate ? '%' : '일'}</span>
      </div>
    </div>
    {isRate && (
      <div className="w-full bg-gray-100 h-1.5 mt-3 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${rateVal}%` }} />
      </div>
    )}
  </div>
);

const MenuBtn = ({ onClick, icon: Icon, title, isSub = false, count = 0, mainClass = "" }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-4 rounded-lg transition-colors ${isSub ? "text-gray-500 hover:text-gray-800 hover:bg-gray-50 py-2 text-sm font-medium" : `${mainClass} py-3 font-bold`}`}>
    <span className="flex items-center gap-2"><Icon className="w-4 h-4"/> {title}</span>
    {isSub ? <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{count}건</span> : <ChevronRight className="w-4 h-4 opacity-50" />}
  </button>
);

export default function DashboardClient({ 
  userName, department, role, totalLeave = 0, usedLeave = 0, extraTotalLeave = 0, extraUsedLeave = 0,
  leaveRequestCount, overtimeRequestCount, pendingApprovalCount, employees = [] 
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient(); 
  const currentYear = new Date().getFullYear();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ total: totalLeave, leaveCount: leaveRequestCount, otCount: overtimeRequestCount });
  
  const [att, setAtt] = useState({ 
    status: 'none' as 'none' | 'checked_in' | 'checked_out', 
    inTime: null as string | null, 
    outTime: null as string | null, 
    autoDate: null as string | null,
    autoTime: null as string | null 
  });
  
  const [m, setM] = useState({ leave: false, history: false, work: false, approval: false, overtime: false });
  const [selectedTeamMember, setSelectedTeamMember] = useState<Employee | null>(null);

  const toggleM = (k: keyof typeof m, v: boolean) => setM(p => ({ ...p, [k]: v }));

  useEffect(() => setStats(s => ({ ...s, leaveCount: leaveRequestCount, otCount: overtimeRequestCount })), [leaveRequestCount, overtimeRequestCount]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const yestDateStr = getDateStr(-1); // 어제 날짜 문자열
      
      const [todayRes, yestRes] = await Promise.all([
        supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', getDateStr()).maybeSingle(),
        supabase.from('attendance').select('is_auto_checkout, clock_out').eq('user_id', user.id).eq('date', yestDateStr).maybeSingle()
      ]);

      if (todayRes.data) {
        setAtt(p => ({
          ...p,
          inTime: todayRes.data.clock_in ? new Date(todayRes.data.clock_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : null,
          outTime: todayRes.data.clock_out ? new Date(todayRes.data.clock_out).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : null,
          status: todayRes.data.clock_in ? (todayRes.data.clock_out ? 'checked_out' : 'checked_in') : 'none'
        }));
      }
      
      // 👈 로컬스토리지: 사용자가 이미 경고창을 닫았는지 확인
      const isDismissed = localStorage.getItem(`hide_auto_checkout_${yestDateStr}`);

      if (yestRes.data?.is_auto_checkout && !isDismissed) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        const autoTimeStr = yestRes.data.clock_out 
          ? new Date(yestRes.data.clock_out).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) 
          : '시간 미상';

        setAtt(p => ({ 
          ...p, 
          autoDate: `${String(y.getMonth() + 1).padStart(2, '0')}/${String(y.getDate()).padStart(2, '0')}`,
          autoTime: autoTimeStr 
        }));
      }
    })();
    getMyCurrentYearStats().then(s => s?.totalLeave !== undefined && setStats(p => ({ ...p, total: s.totalLeave }))).catch(console.error);
  }, [supabase]);

  // 👈 로컬스토리지: 경고창 닫기 버튼 클릭 시 기록 저장
  const handleDismissAutoCheckout = () => {
    localStorage.setItem(`hide_auto_checkout_${getDateStr(-1)}`, 'true');
    setAtt(p => ({...p, autoDate: null}));
  };

  const handleAttendance = async (type: 'in' | 'out' | 'cancel') => {
    if (type === 'cancel' && !confirm("퇴근 처리를 취소하시겠습니까? 다시 근무 중 상태로 변경됩니다.")) return;
    try {
      setIsProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("로그인 정보가 없습니다.");

      const device = detectDevice(), now = new Date(), today = getDateStr();
      const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

      if (type === 'in') {
        const { error } = await supabase.from('attendance').insert([{ user_id: user.id, date: today, clock_in: now.toISOString(), in_device: device }]);
        if (error) throw error;
        setAtt(p => ({ ...p, inTime: timeStr, status: 'checked_in' }));
        alert(`출근 완료 (${device === 'mobile' ? '모바일' : 'PC'})`);
      } else {
        const isCancel = type === 'cancel';
        const { error } = await supabase.from('attendance').update({ clock_out: isCancel ? null : now.toISOString(), out_device: isCancel ? null : device }).eq('user_id', user.id).eq('date', today);
        if (error) throw error;
        setAtt(p => ({ ...p, outTime: isCancel ? null : timeStr, status: isCancel ? 'checked_in' : 'checked_out' }));
        alert(isCancel ? "퇴근이 취소되었습니다." : "퇴근 처리가 완료되었습니다.");
      }
    } catch (e) { alert("처리에 실패했습니다. 다시 시도해주세요."); } finally { setIsProcessing(false); }
  };

  const handleLogout = async () => { try { await supabase.auth.signOut(); router.push("/login"); router.refresh(); } catch { alert("로그아웃 실패"); } };
  const handleRefresh = () => { setIsRefreshing(true); router.refresh(); setTimeout(() => setIsRefreshing(false), 1000); };

  const aRem = stats.total - usedLeave, aRate = calcRate(stats.total, usedLeave);
  const eRem = extraTotalLeave - extraUsedLeave, eRate = calcRate(extraTotalLeave, extraUsedLeave);

  const renderStats = (title: string, Icon: any, iconColor: string, labels: string[], vals: any[], colors: string[], rate: number, barColor: string) => (
    <div>
      <h3 className="text-gray-700 font-bold mb-3 flex items-center gap-2"><Icon className={`w-5 h-5 ${iconColor}`} /> {title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label={labels[0]} val={vals[0]} valColor={colors[0]} />
        <StatBox label={labels[1]} val={vals[1]} valColor={colors[1]} />
        <StatBox label={labels[2]} val={vals[2]} valColor={colors[2]} />
        <StatBox label={labels[3]} val={vals[3]} valColor={colors[3]} isRate rateVal={rate} barColor={barColor} />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <LeaveApplicationModal isOpen={m.leave} onClose={() => toggleM('leave', false)} onSuccess={() => { setStats(s => ({...s, leaveCount: s.leaveCount + 1})); router.refresh(); }} />
      <LeaveHistoryModal isOpen={m.history} onClose={() => toggleM('history', false)} onDelete={() => { setStats(s => ({...s, leaveCount: Math.max(0, s.leaveCount - 1)})); router.refresh(); }} />
      <WorkHistoryModal isOpen={m.work} onClose={() => toggleM('work', false)} />
      <ApprovalModal isOpen={m.approval} onClose={() => toggleM('approval', false)} />
      <OvertimeApplicationModal isOpen={m.overtime} onClose={() => toggleM('overtime', false)} onSuccess={() => { setStats(s => ({...s, otCount: s.otCount + 1})); router.refresh(); }} />

      <div className="w-full max-w-[95%] mx-auto space-y-8">
        
        {att.autoDate && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-1.5 bg-orange-100 rounded-full shrink-0 mt-0.5"><AlertTriangle className="w-4 h-4 text-orange-600" /></div>
            <div className="flex-1">
              <h3 className="font-bold text-orange-800 text-sm">어제({att.autoDate}) 퇴근 기록이 누락되었습니다.</h3>
              <p className="text-orange-700 text-sm mt-1">시스템에 의해 <strong>{att.autoTime}로 자동 마감</strong> 처리되었습니다.</p>
            </div>
            {/* 👈 로컬스토리지: 닫기 버튼 클릭 이벤트 연결 */}
            <button onClick={handleDismissAutoCheckout} className="text-orange-400 hover:text-orange-600 p-1">✕</button>
          </div>
        )}

        {/* 헤더 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">안녕하세요, {userName}님! 👋</h1>
            <p className="text-gray-500 text-sm mt-1">{department} | 오늘도 좋은 하루 되세요.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm font-bold text-sm">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} /><span className="hidden sm:inline">새로고침</span>
            </button>
            {role === 'manager' && <Link href="/admin" className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-sm"><Settings className="w-4 h-4" /><span className="hidden sm:inline">관리자</span></Link>}
            <button onClick={handleLogout} className="flex items-center gap-2 bg-white hover:bg-gray-50 text-red-600 border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm font-bold text-sm"><LogOut className="w-4 h-4" /><span className="hidden sm:inline">로그아웃</span></button>
          </div>
        </div>

        <PushManager />

        {/* 상단 통계 */}
        <div className="space-y-6">
          {stats.total === 0 && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl shadow-sm flex items-start gap-4">
              <div className="p-2 bg-amber-100 rounded-full shrink-0"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
              <div>
                <h3 className="font-bold text-amber-800 text-sm">{currentYear}년도 설정된 기초 연차가 없습니다.</h3>
                <p className="text-amber-700 text-sm mt-1">할당된 연차가 0일입니다. 관리자에게 <strong>{currentYear}년 연차 설정</strong>을 요청하세요.</p>
              </div>
            </div>
          )}

          {renderStats(`${currentYear}년 연차 현황`, Calendar, "text-blue-600",
            [`${currentYear}년 총 연차`, "사용 연차", "잔여 연차", "연차 소진율"],
            [format(stats.total), format(usedLeave), format(aRem), aRate.toFixed(1)],
            [stats.total === 0 ? 'text-gray-400' : 'text-gray-800', 'text-blue-600', aRem < 0 ? 'text-red-500' : 'text-green-600', 'text-purple-600'],
            aRate, "bg-purple-500"
          )}
          {renderStats("연차 외 휴가 현황", PieChart, "text-orange-500",
            ["총 보상 휴가", "사용", "잔여", "보상휴가 사용률"],
            [format(extraTotalLeave), format(extraUsedLeave), format(eRem), eRate.toFixed(1)],
            ['text-gray-800', 'text-orange-600', eRem < 0 ? 'text-red-500' : 'text-gray-800', 'text-gray-600'],
            eRate, "bg-orange-500"
          )}
        </div>

        {/* 하단 레이아웃 */}
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-4 flex flex-col h-full gap-6 order-2 lg:order-1">
            <div className="hidden lg:flex bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative flex-col min-h-[1200px]">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 shrink-0">
                <Clock className="w-5 h-5 text-blue-500" /> {selectedTeamMember ? `${selectedTeamMember.name}님의 일정 조회` : '근태 캘린더'}
              </h2>
              <div className="flex-1 w-full h-full relative"><CalendarView targetUser={selectedTeamMember} /></div>
            </div>
            <DashboardWidgets />
          </div>

          <div className="lg:col-span-1 space-y-6 order-1 lg:order-2">
            {/* 출퇴근 위젯 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" />오늘의 출퇴근</h3></div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">출근 시간</span><span className={`font-bold ${att.inTime ? 'text-blue-600' : 'text-gray-400'}`}>{att.inTime || '미등록'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">퇴근 시간</span><span className={`font-bold ${att.outTime ? 'text-red-500' : 'text-gray-400'}`}>{att.outTime || '미등록'}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={() => handleAttendance('in')} disabled={att.status !== 'none' || isProcessing} className={`py-2.5 rounded-lg font-bold text-sm ${att.status === 'none' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {isProcessing && att.status === 'none' ? '처리중...' : '출근하기'}
                  </button>
                  {att.status === 'checked_out' ? (
                    <button onClick={() => handleAttendance('cancel')} disabled={isProcessing} className="py-2.5 rounded-lg font-bold text-sm bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex justify-center items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />퇴근 취소</button>
                  ) : (
                    <button onClick={() => handleAttendance('out')} disabled={att.status !== 'checked_in' || isProcessing} className={`py-2.5 rounded-lg font-bold text-sm ${att.status === 'checked_in' ? 'bg-gray-800 hover:bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {isProcessing && att.status === 'checked_in' ? '처리중...' : '퇴근하기'}
                    </button>
                  )}
                </div>
                <div className="pt-2 border-t border-gray-100 mt-2">
                  <Link href="/attendance" className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-bold text-sm flex items-center justify-center gap-2"><List className="w-4 h-4 text-gray-500" />전체 직원 출퇴근 명부</Link>
                </div>
              </div>
            </div>

            <button onClick={() => toggleM('approval', true)} className="w-full bg-gray-800 hover:bg-gray-900 text-white p-4 rounded-xl shadow-lg flex items-center justify-between group">
              <div className="flex items-center gap-3"><div className="p-2 bg-gray-700 rounded-lg"><Inbox className="w-5 h-5 text-yellow-400" /></div><div className="text-sm font-bold">결재함 열기</div></div>
              {pendingApprovalCount > 0 && <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">{pendingApprovalCount}</div>}
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2"><UserCog className="w-4 h-4 text-gray-500" />내 근태 관리</h3></div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <MenuBtn onClick={() => toggleM('leave', true)} icon={PlusCircle} title="연차 신청" mainClass="bg-blue-50 hover:bg-blue-100 text-blue-700" />
                  <MenuBtn onClick={() => toggleM('history', true)} icon={History} title="신청 내역 조회" isSub count={stats.leaveCount} />
                </div>
                <div className="h-px bg-gray-100"></div>
                <div className="space-y-2">
                  <MenuBtn onClick={() => toggleM('overtime', true)} icon={Clock} title="초과근무 신청" mainClass="bg-purple-50 hover:bg-purple-100 text-purple-700" />
                  <MenuBtn onClick={() => toggleM('work', true)} icon={List} title="초과근무 내역 조회" isSub count={stats.otCount} />
                </div>
              </div>
            </div>

            <Link href="/schedule" className="w-full bg-white hover:bg-gray-50 p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg"><Users className="w-5 h-5 text-indigo-600" /></div>
                <div className="text-left"><div className="text-sm font-bold text-gray-800">전체 직원 근태 조회</div><div className="text-xs text-gray-500">모든 직원의 현황 파악</div></div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </Link>

            <TeamListWidget employees={employees} onSelectUser={setSelectedTeamMember} selectedUser={selectedTeamMember} />
          </div>
        </div>
      </div>
    </main>
  );
}
