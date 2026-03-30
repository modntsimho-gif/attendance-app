"use client";

import { X, Calendar as CalendarIcon, Users, FileText, Plus, CheckCircle2, XCircle, Bookmark, Save, ArrowDownToLine, Trash2, Calculator, Clock, AlertCircle, RefreshCw, FileInput, FilePenLine, FileX2, ChevronRight } from "lucide-react";
import { submitLeaveRequest } from "@/app/actions"; 
import { useState, useEffect, useRef } from "react"; 
import { getApprovers } from "@/app/actions/user"; 
import { getSavedLines, saveLine, deleteLine } from "@/app/actions/approval-line"; 
import { createClient } from "@/utils/supabase/client";

const LEAVE_OPTIONS = [
  { label: "반반차", days: 0.25 },
  { label: "반차", days: 0.50 },
  { label: "연차", days: 1.00 },
  { label: "대체휴무_반반일", days: 0.25 },
  { label: "대체휴무_반일", days: 0.50 },
  { label: "대체휴무_전일", days: 1.00 },
  { label: "특별휴가", days: 0 },
  { label: "공가", days: 0 },
  { label: "생리휴가", days: 0 },
  { label: "병가", days: 0 },
  { label: "태아검진휴가", days: 0 },
  { label: "육아휴직", days: 0 },
];

const REQUEST_TYPES = [
  { id: "create", label: "신청", icon: FileInput },
  { id: "update", label: "변경", icon: FilePenLine },
  { id: "cancel", label: "취소", icon: FileX2 },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2).toString().padStart(2, '0');
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour}:${minute}`;
});

interface LeaveApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any;
}

interface ApproverUser {
  id: string;
  name: string;
  rank: string;
  dept: string;
  status?: string;
}

interface OvertimeRecord {
  id: string;
  title: string;
  work_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  recognized_days: number;
  recognized_hours: number;
  used_hours: number;
  reason: string;
  // ⭐️ 아래 4개 필드 추가
  status?: string;
  request_type?: string;
  original_overtime_request_id?: string;
  created_at?: string;
}

interface LeaveRecord {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  total_days: number;
  reason: string;
  handover_notes?: string;
  status: string;
  created_at: string;
  overtime_request_id?: string; // 기존 단일 ID 호환용
  overtime_request_ids?: string; // ⭐️ 다중 ID JSON 배열 문자열
}

export default function LeaveApplicationModal({ isOpen, onClose, onSuccess, initialData }: LeaveApplicationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const supabase = createClient();
  const isViewMode = !!initialData;

  const [colleagues, setColleagues] = useState<ApproverUser[]>([]);
  const [approvers, setApprovers] = useState<ApproverUser[]>([]);
  
  const [isApproverSelectOpen, setIsApproverSelectOpen] = useState(false);
  const [isLineManagerOpen, setIsLineManagerOpen] = useState(false);
  const [editingApproverIndex, setEditingApproverIndex] = useState<number | null>(null);

  const [savedLines, setSavedLines] = useState<any[]>([]);
  const [newLineTitle, setNewLineTitle] = useState("");

  const [requestType, setRequestType] = useState("create");

  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRecord[]>([]);
  const [selectedOriginalLeaveId, setSelectedOriginalLeaveId] = useState<string>("");
  const [originalLeaveForView, setOriginalLeaveForView] = useState<LeaveRecord | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLeaveType, setSelectedLeaveType] = useState(""); 
  const [leaveFactor, setLeaveFactor] = useState(1.0);
  const [calcResult, setCalcResult] = useState({ duration: 0, totalDeduction: 0 });
  
  const [reason, setReason] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [overtimeList, setOvertimeList] = useState<OvertimeRecord[]>([]);
  
  // ⭐️ [변경] 단일 ID에서 배열로 변경 (다중 선택 지원)
  const [selectedOvertimeIds, setSelectedOvertimeIds] = useState<string[]>([]);
  const [linkedOvertimes, setLinkedOvertimes] = useState<OvertimeRecord[]>([]);

  useEffect(() => {
    if (isOpen) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      if (isViewMode && initialData?.id) {
        setStartDate(initialData.start_date);
        setEndDate(initialData.end_date);
        setSelectedLeaveType(initialData.leave_type);
        setReason(initialData.reason || "");
        setHandoverNotes(initialData.handover_notes || "");
        
        setStartTime(initialData.start_time?.slice(0, 5) || "");
        setEndTime(initialData.end_time?.slice(0, 5) || "");
        
        setRequestType(initialData.request_type || "create");

        const factor = LEAVE_OPTIONS.find(opt => opt.label === initialData.leave_type)?.days || 0;
        setLeaveFactor(factor);

        if (initialData.original_leave_request_id) {
          const fetchOriginalLeave = async () => {
            const { data } = await supabase
              .from("leave_requests")
              .select("*")
              .eq("id", initialData.original_leave_request_id)
              .maybeSingle();
            
            if (data) {
              setOriginalLeaveForView(data);
              setSelectedOriginalLeaveId(data.id);
            }
          };
          fetchOriginalLeave();
        }

        // ⭐️ [변경] 여러 개의 연결된 초과근무 내역 불러오기
        if (initialData.overtime_request_ids || initialData.overtime_request_id) {
          const fetchLinkedOts = async () => {
            let ids: string[] = [];
            const rawIds = initialData.overtime_request_ids || initialData.overtime_request_id;
            try {
              // JSON 배열 문자열인지 확인 후 파싱
              ids = typeof rawIds === 'string' && rawIds.startsWith('[') 
                ? JSON.parse(rawIds) 
                : [rawIds];
            } catch(e) { 
              ids = [rawIds];
            }
            
            if (ids.length > 0) {
              const { data } = await supabase.from("overtime_requests").select("*").in("id", ids);
              if (data) setLinkedOvertimes(data);
            }
          };
          fetchLinkedOts();
        }

        const fetchSavedApprovers = async () => {
            const { data: lines } = await supabase.from("approval_lines").select("*").eq("leave_request_id", initialData.id).order("step_order", { ascending: true });
            if (!lines) return;
            const { data: profiles } = await supabase.from("profiles").select("id, name, position, department").in("id", lines.map(l => l.approver_id));
            if (profiles) {
              setApprovers(lines.map((line) => {
                const profile = profiles.find((p) => p.id === line.approver_id);
                return {
                  id: line.approver_id,
                  name: profile?.name || "알수없음",
                  rank: profile?.position || "-",
                  dept: profile?.department || "-",
                  status: line.status,
                };
              }));
            }
        };
        fetchSavedApprovers();
      } else {
        const fetchColleagues = async () => {
          const data = await getApprovers();
          setColleagues(data);
        };
        fetchColleagues();
        setApprovers([]);
        setStartDate("");
        setEndDate("");
        setLeaveFactor(1.0); 
        setSelectedLeaveType("연차");
        setReason("");
        setHandoverNotes("");
        setStartTime("");
        setEndTime("");
        setCalcResult({ duration: 0, totalDeduction: 0 });
        
        // ⭐️ [변경] 초기화 시 배열 비우기
        setOvertimeList([]);
        setSelectedOvertimeIds([]);
        setLinkedOvertimes([]); 
        setEditingApproverIndex(null);
        
        setRequestType("create");
        setSelectedOriginalLeaveId("");
        setApprovedLeaves([]);
        setOriginalLeaveForView(null);
      }
    } else {
      setIsApproverSelectOpen(false);
      setIsLineManagerOpen(false);
      setEditingApproverIndex(null);
    }
  }, [isOpen, isViewMode, initialData]);

  useEffect(() => {
    if (!isViewMode && (requestType === 'update' || requestType === 'cancel') && isOpen) {
      
      const fetchValidLeaves = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("leave_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (data) {
          const itemMap = new Map<string, LeaveRecord>();
          const parentMap = new Map<string, string>();

          data.forEach((item: any) => {
            itemMap.set(item.id, item);
            if (item.original_leave_request_id) {
              parentMap.set(item.id, item.original_leave_request_id);
            }
          });

          const findRootId = (currentId: string): string => {
            let pointer = currentId;
            while (parentMap.has(pointer)) {
              pointer = parentMap.get(pointer)!;
              if (!itemMap.has(pointer)) break;
            }
            return pointer;
          };

          const groups: Record<string, LeaveRecord[]> = {};
          data.forEach((item: any) => {
            const rootId = findRootId(item.id);
            if (!groups[rootId]) groups[rootId] = [];
            groups[rootId].push(item);
          });

          const validLeaves: LeaveRecord[] = [];

          Object.values(groups).forEach((group) => {
            group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const latest = group[0]; 

            if (latest.status === 'approved' && (latest as any).request_type !== 'cancel') {
              validLeaves.push(latest);
            }
          });

          setApprovedLeaves(validLeaves);
        }
      };

      fetchValidLeaves();
      
      setSelectedOriginalLeaveId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      
    } else if (requestType === 'create') {
      setSelectedOriginalLeaveId("");
      setReason("");
    }
  }, [requestType, isOpen, isViewMode]);

  const handleSelectOriginalLeave = (leave: LeaveRecord) => {
    setSelectedOriginalLeaveId(leave.id);
    
    setStartDate(leave.start_date);
    setEndDate(leave.end_date);
    setSelectedLeaveType(leave.leave_type);
    
    setStartTime(leave.start_time?.slice(0, 5) || "");
    setEndTime(leave.end_time?.slice(0, 5) || "");
    setHandoverNotes(leave.handover_notes || "");

    if (requestType === 'cancel') {
        setReason(""); 
    } else {
        setReason(leave.reason || "");
    }

    // ⭐️ [변경] 원본 연차의 초과근무 매핑 데이터 복원 (배열 처리)
    if (leave.overtime_request_ids || leave.overtime_request_id) {
        const rawIds = leave.overtime_request_ids || leave.overtime_request_id;
        try {
            const ids = typeof rawIds === 'string' && rawIds.startsWith('[') ? JSON.parse(rawIds) : [rawIds];
            setSelectedOvertimeIds(ids);
        } catch(e) {
            setSelectedOvertimeIds([rawIds as string]);
        }
    }

    const factor = LEAVE_OPTIONS.find(opt => opt.label === leave.leave_type)?.days || 1.0;
    setLeaveFactor(factor);
  };

  useEffect(() => {
    const isCompensatory = selectedLeaveType.startsWith("대체휴무");
    if (isCompensatory && !isViewMode && isOpen) {
      const fetchOvertimes = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // 1. 유저의 모든 초과근무 내역을 가져옵니다.
        const { data } = await supabase
          .from("overtime_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
          
        if (data) {
          // 2. 연차와 동일하게 원본 ID를 기준으로 그룹화합니다.
          const itemMap = new Map<string, any>();
          const parentMap = new Map<string, string>();

          data.forEach((item: any) => {
            itemMap.set(item.id, item);
            if (item.original_overtime_request_id) {
              parentMap.set(item.id, item.original_overtime_request_id);
            }
          });

          const findRootId = (currentId: string): string => {
            let pointer = currentId;
            while (parentMap.has(pointer)) {
              pointer = parentMap.get(pointer)!;
              if (!itemMap.has(pointer)) break;
            }
            return pointer;
          };

          const groups: Record<string, any[]> = {};
          data.forEach((item: any) => {
            const rootId = findRootId(item.id);
            if (!groups[rootId]) groups[rootId] = [];
            groups[rootId].push(item);
          });

          const validOvertimes: OvertimeRecord[] = [];

          // 3. 각 그룹의 최신 상태를 확인하여 유효한 것만 필터링합니다.
          Object.values(groups).forEach((group) => {
            // 최신순 정렬
            group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const latest = group[0]; 

            // ⭐️ 핵심: 최신 상태가 '승인'이고, '취소' 신청이 아닌 경우만 포함
            if (latest.status === 'approved' && latest.request_type !== 'cancel') {
              const remaining = (latest.recognized_hours || 0) - (latest.used_hours || 0);
              if (remaining > 0) {
                validOvertimes.push(latest);
              }
            }
          });

          // 4. 근무일 최신순으로 정렬하여 보여주기
          validOvertimes.sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());
          
          setOvertimeList(validOvertimes);
        }
      };
      fetchOvertimes();
    } else {
      if (!isViewMode) { setOvertimeList([]); setSelectedOvertimeIds([]); }
    }
  }, [selectedLeaveType, isOpen, isViewMode]);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = end.getTime() - start.getTime();
      let diffDays = diffTime / (1000 * 3600 * 24) + 1; 
      if (diffDays < 1) diffDays = 0; 
      const total = diffDays * leaveFactor;
      setCalcResult({ duration: Math.floor(diffDays), totalDeduction: total });
    } else {
      setCalcResult({ duration: 0, totalDeduction: 0 });
    }
  }, [startDate, endDate, leaveFactor]);

  useEffect(() => { if (isLineManagerOpen) loadSavedLines(); }, [isLineManagerOpen]);
  const loadSavedLines = async () => { const lines = await getSavedLines(); setSavedLines(lines); };
  
  const handleSaveLine = async () => { 
    if (!newLineTitle.trim()) { alert("결재선 이름을 입력해주세요."); return; }
    if (approvers.length === 0) { alert("저장할 결재자가 없습니다."); return; }
    const res = await saveLine(newLineTitle, approvers);
    if (res.error) alert(res.error);
    else { setNewLineTitle(""); loadSavedLines(); }
  };

  const handleDeleteLine = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteLine(id);
    loadSavedLines();
  };

  const handleApplyLine = (savedApprovers: any[]) => {
    if (confirm("현재 지정된 결재자가 초기화되고 선택한 결재선이 적용됩니다. 계속하시겠습니까?")) {
      setApprovers(savedApprovers);
      setIsLineManagerOpen(false);
    }
  };

  const handleSelectApprover = (user: ApproverUser) => {
    if (isViewMode) return;
    const isDuplicate = approvers.some((a, i) => a.id === user.id && i !== editingApproverIndex);
    if (isDuplicate) { alert("이미 추가된 결재자입니다."); return; }

    if (editingApproverIndex !== null) {
      const newApprovers = [...approvers];
      newApprovers[editingApproverIndex] = user;
      setApprovers(newApprovers);
      setEditingApproverIndex(null); 
    } else {
      if (approvers.length >= 2) { alert("결재자는 최대 2명까지만 지정 가능합니다."); return; }
      setApprovers([...approvers, user]);
    }
    setIsApproverSelectOpen(false);
  };

  const removeApprover = (index: number) => {
    if (isViewMode) return;
    const newApprovers = [...approvers];
    newApprovers.splice(index, 1);
    setApprovers(newApprovers);
  };

  const handleApproverClick = (index: number) => {
    if (isViewMode) return;
    setEditingApproverIndex(index);
    setIsApproverSelectOpen(true);
  };

  const handleAddClick = () => {
    setEditingApproverIndex(null);
    setIsApproverSelectOpen(true);
  };

  async function handleSubmit(formData: FormData) {
    if (isViewMode) return;
    if (isSubmittingRef.current) return;

    if (approvers.length === 0) { alert("최소 1명 이상의 결재자를 지정해야 합니다."); return; }
    
    if ((requestType === 'update' || requestType === 'cancel') && !selectedOriginalLeaveId) {
      alert(`${requestType === 'update' ? '변경' : '취소'}할 기존 연차 내역을 선택해주세요.`);
      return;
    }

    // ⭐️ [변경] 대체휴무 신청 시 다중 선택된 시간 합산 검증
    if (selectedLeaveType.startsWith("대체휴무")) {
      if (selectedOvertimeIds.length === 0) { alert("대체휴무 정보가 올바르지 않습니다. (초과근무를 선택해주세요)"); return; }
      
      if (requestType !== 'cancel') {
          const selectedOtItems = overtimeList.filter(ot => selectedOvertimeIds.includes(ot.id));
          const totalRemaining = selectedOtItems.reduce((sum, ot) => sum + ((ot.recognized_hours || 0) - (ot.used_hours || 0)), 0);
          const actualRequiredDays = calcResult.totalDeduction > 0 ? calcResult.totalDeduction : leaveFactor;
          const requiredHours = actualRequiredDays * 8; 
          
          if (totalRemaining < requiredHours) {
            alert(`선택한 초과근무들의 총 잔여 시간(${totalRemaining}시간)이 신청하려는 시간(${requiredHours}시간)보다 부족합니다.`);
            return;
          }
      }
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await submitLeaveRequest(formData);
      
      if (result?.error) { 
        alert(`오류 발생: ${result.error}`); 
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      } else {
        alert("결재가 성공적으로 상신되었습니다! 🎉");
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (error) {
      console.error(error);
      alert("알 수 없는 오류가 발생했습니다.");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const renderStatusIcon = (status?: string) => {
    if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-600" />;
    return <span className="text-[10px] text-gray-500 font-medium">대기</span>;
  };

  if (!isOpen) return null;

  const isCompensatory = selectedLeaveType.startsWith("대체휴무");
  
  // ⭐️ [변경] 선택된 항목들의 총 잔여 시간 계산
  const currentReqDays = calcResult.totalDeduction > 0 ? calcResult.totalDeduction : leaveFactor;
  const currentReqHours = currentReqDays * 8;
  const selectedOtItems = overtimeList.filter(ot => selectedOvertimeIds.includes(ot.id));
  const totalSelectedRemaining = selectedOtItems.reduce((sum, ot) => sum + ((ot.recognized_hours || 0) - (ot.used_hours || 0)), 0);
  
  // 합산된 시간이 필요 시간보다 크거나 같으면 유효함
  const isSelectionValid = requestType === 'cancel' || (selectedOvertimeIds.length > 0 && totalSelectedRemaining >= currentReqHours);

  const isFormDisabled = isViewMode || requestType === 'cancel';
  
  const isOriginalRequired = requestType === 'update' || requestType === 'cancel';
  const isOriginalMissing = isOriginalRequired && !selectedOriginalLeaveId;
  const isSubmitDisabled = isSubmitting || approvers.length === 0 || isOriginalMissing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative">
        
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {isViewMode ? "연차 신청서 상세" : "연차 신청서 작성"}
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              {isViewMode ? `문서번호: LEAVE-${initialData.id.slice(0, 8)}` : "문서번호: 자동생성 (임시저장)"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form action={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <input type="hidden" name="approversJson" value={JSON.stringify(approvers)} />
          <input type="hidden" name="totalLeaveDays" value={calcResult.totalDeduction} />
          {/* ⭐️ [변경] 배열을 JSON 문자열로 변환하여 전송 */}
          <input type="hidden" name="overtimeRequestIds" value={JSON.stringify(selectedOvertimeIds)} />
          <input type="hidden" name="requestType" value={requestType} />
          <input type="hidden" name="originalLeaveId" value={selectedOriginalLeaveId} />
          
          {requestType === 'cancel' && (
            <>
                <input type="hidden" name="startDate" value={startDate} />
                <input type="hidden" name="endDate" value={endDate} />
                <input type="hidden" name="leaveType" value={selectedLeaveType} />
                <input type="hidden" name="startTime" value={startTime} />
                <input type="hidden" name="endTime" value={endTime} />
            </>
          )}

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            <section>
               <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Users className="w-4 h-4" /> {isViewMode ? "결재 진행 현황" : "결재선 지정"}
                </h3>
                {!isViewMode && (
                  <button 
                    type="button" 
                    onClick={() => setIsLineManagerOpen(true)}
                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    <Bookmark className="w-3 h-3" />
                    나만의 결재선
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-3 overflow-x-auto pb-2 relative">
                <div className="min-w-[100px] p-3 border border-blue-200 bg-blue-50 rounded-lg text-center flex-shrink-0">
                  <div className="text-xs text-blue-600 font-bold mb-1">기안</div>
                  <div className="text-sm font-bold text-gray-900">나 (본인)</div>
                  <div className="text-xs text-gray-600">신청완료</div>
                </div>
                <div className="text-gray-400">→</div>
                
                {approvers.map((app, idx) => (
                  <div key={app.id} className="flex items-center gap-3">
                    <div 
                      onClick={() => handleApproverClick(idx)}
                      className={`min-w-[100px] p-3 border rounded-lg text-center relative group flex-shrink-0 transition-all ${
                        app.status === 'approved' ? 'bg-blue-50 border-blue-300' : 
                        app.status === 'rejected' ? 'bg-red-50 border-red-300' : 
                        !isViewMode ? 'bg-white border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer' : 'bg-white border-blue-200'
                      }`}
                    >
                      <div className="text-xs text-gray-600 mb-1 flex justify-center items-center gap-1">
                        결재 ({idx + 1}차) {isViewMode && renderStatusIcon(app.status)}
                      </div>
                      <div className="text-sm font-bold text-gray-900">{app.name}</div>
                      <div className="text-xs text-gray-600">{app.rank}</div>
                      
                      {!isViewMode && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                            <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" /> 변경
                            </span>
                        </div>
                      )}

                      {!isViewMode && (
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeApprover(idx);
                          }} 
                          className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 z-10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {idx < approvers.length - 1 && <div className="text-gray-400">→</div>}
                  </div>
                ))}

                {!isViewMode && approvers.length < 2 && (
                  <>
                    {approvers.length > 0 && <div className="text-gray-400">→</div>}
                    <button 
                      type="button"
                      onClick={handleAddClick}
                      className="min-w-[100px] p-3 border border-dashed border-gray-300 rounded-lg text-center hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-1 flex-shrink-0"
                    >
                      <Plus className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500 font-medium">결재자 추가</span>
                    </button>
                  </>
                )}
              </div>
            </section>

            <hr className="border-gray-100" />

            <section className="space-y-6 pointer-events-auto">
              
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">신청 유형</label>
                <div className="flex gap-4">
                  {REQUEST_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = requestType === type.id;
                    return (
                      <label 
                        key={type.id}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all flex-1 justify-center ${
                          isSelected 
                            ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500 text-blue-700" 
                            : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                        } ${isViewMode ? "cursor-default opacity-80" : ""}`}
                      >
                        <input 
                          type="radio" 
                          name="requestTypeRadio" 
                          value={type.id}
                          checked={isSelected}
                          disabled={isViewMode}
                          onChange={() => setRequestType(type.id)}
                          className="hidden" 
                        />
                        <Icon className={`w-4 h-4 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                        <span className="text-sm font-bold">{type.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {(requestType === 'update' || requestType === 'cancel') && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    {requestType === 'update' ? "변경 대상 연차" : "취소 대상 연차"}
                    {isViewMode && <span className="text-xs font-normal text-gray-500 ml-2">(원본 데이터)</span>}
                  </label>

                  {isViewMode ? (
                    originalLeaveForView ? (
                      <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold bg-white border border-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                              {originalLeaveForView.leave_type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(originalLeaveForView.created_at).toLocaleDateString()} 신청분
                            </span>
                          </div>
                          <div className="text-sm font-bold text-gray-900 flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5 text-gray-500" />
                            {originalLeaveForView.start_date} ~ {originalLeaveForView.end_date}
                            <span className="text-xs font-normal text-gray-600 ml-1">
                              ({originalLeaveForView.total_days}일)
                            </span>
                          </div>
                          {originalLeaveForView.reason && (
                            <div className="text-xs text-gray-600 mt-1 truncate max-w-[300px]">
                              사유: {originalLeaveForView.reason}
                            </div>
                          )}
                        </div>
                        <div className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border">
                          원본
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 p-3 border rounded bg-gray-50">
                        원본 연차 정보를 불러올 수 없습니다.
                      </div>
                    )
                  ) : (
                    <>
                      <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 max-h-60 overflow-y-auto space-y-2">
                        {approvedLeaves.length === 0 ? (
                          <div className="text-center text-sm text-gray-500 py-4">선택 가능한 승인된 연차 내역이 없습니다.</div>
                        ) : (
                          approvedLeaves.map((leave) => (
                            <div 
                              key={leave.id}
                              onClick={() => handleSelectOriginalLeave(leave)}
                              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${
                                selectedOriginalLeaveId === leave.id 
                                  ? "bg-blue-100 border-blue-500 ring-1 ring-blue-500" 
                                  : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{leave.leave_type}</span>
                                  <span className="text-xs text-gray-500">{new Date(leave.created_at).toLocaleDateString()} 신청</span>
                                </div>
                                <div className="text-sm font-bold text-gray-900 flex items-center gap-1">
                                  <CalendarIcon className="w-3.5 h-3.5 text-gray-500" />
                                  {leave.start_date} ~ {leave.end_date}
                                  <span className="text-xs font-normal text-gray-600 ml-1">({leave.total_days}일)</span>
                                </div>
                                {leave.reason && <div className="text-xs text-gray-600 mt-1 truncate max-w-[300px]">{leave.reason}</div>}
                              </div>
                              <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-5 h-5" />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {selectedOriginalLeaveId && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {requestType === 'update' 
                            ? "선택한 연차 정보가 적용되었습니다. 내용을 수정 후 결재를 상신하세요."
                            : "선택한 연차를 취소합니다. 아래에 취소 사유를 입력해주세요."
                          }
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className={isFormDisabled ? "pointer-events-none grayscale" : ""}>
                <label className="block text-sm font-bold text-gray-800 mb-2">휴가 종류</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {LEAVE_OPTIONS.map((option) => (
                    <label key={option.label} className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                      (isViewMode ? initialData?.leave_type === option.label : selectedLeaveType === option.label)
                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${isViewMode && initialData?.leave_type !== option.label ? 'opacity-50' : ''}`}>
                      
                      <div className="flex items-center gap-2 overflow-hidden">
                        <input 
                          type="radio" 
                          name="leaveType" 
                          value={option.label} 
                          required
                          disabled={isFormDisabled}
                          checked={selectedLeaveType === option.label}
                          onChange={() => {
                            setLeaveFactor(option.days);
                            setSelectedLeaveType(option.label);
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 flex-shrink-0" 
                        />
                        <span className="text-sm text-gray-900 truncate font-medium" title={option.label}>{option.label}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                        option.days > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {option.days > 0 ? `-${option.days.toFixed(2)}` : '0.0'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {isCompensatory && (
                <div className={`border rounded-lg p-4 animate-in fade-in slide-in-from-top-2 transition-colors ${
                  isFormDisabled ? "pointer-events-none grayscale bg-gray-50" :
                  isViewMode 
                    ? 'bg-gray-50 border-gray-200' 
                    : isSelectionValid 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                }`}>
                  {/* ⭐️ [변경] 다중 선택 헤더 및 남은 시간 현황판 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className={`w-5 h-5 ${isSelectionValid || isViewMode ? 'text-blue-600' : 'text-gray-600'}`} />
                      <h4 className={`text-sm font-bold ${isSelectionValid || isViewMode ? 'text-blue-800' : 'text-gray-800'}`}>
                        {isViewMode ? "사용된 보상 휴가 원천" : "보상 휴가 원천 선택 (다중 선택 가능)"}
                      </h4>
                    </div>
                    {!isViewMode && (
                      <div className={`text-xs font-bold px-3 py-1.5 rounded-full border ${isSelectionValid ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        모은 시간: {totalSelectedRemaining}h / 필요 시간: {currentReqHours}h
                      </div>
                    )}
                  </div>
                  
                  {isViewMode ? (
                    linkedOvertimes.length > 0 ? (
                      <div className="space-y-2">
                        {linkedOvertimes.map(ot => (
                          <div key={ot.id} className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-sm font-bold text-gray-900 mb-0.5">{ot.title}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                   <CalendarIcon className="w-3 h-3"/> {ot.work_date}
                                   <span className="text-gray-300">|</span>
                                   {ot.start_time?.slice(0,5)}~{ot.end_time?.slice(0,5)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">{ot.reason}</div>
                              </div>
                              <div className="text-right">
                                 <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700">
                                   총 {ot.recognized_hours}시간
                                 </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 p-2">연결된 초과근무 정보를 불러올 수 없습니다.</div>
                    )
                  ) : (
                    <>
                      {overtimeList.length === 0 ? (
                        <div className="text-sm text-gray-500 bg-white p-3 rounded border border-gray-200 text-center">
                          사용 가능한 승인된 초과근무 내역이 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {overtimeList.map((ot) => {
                            const remaining = (ot.recognized_hours || 0) - (ot.used_hours || 0);
                            const isSelected = selectedOvertimeIds.includes(ot.id);

                            return (
                              <label key={ot.id} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-500' 
                                  : 'bg-white hover:bg-gray-50 border-gray-200'
                              }`}>
                                <div className="flex items-center gap-3">
                                  {/* ⭐️ [변경] 라디오 버튼 -> 체크박스 */}
                                  <input 
                                    type="checkbox" 
                                    name="overtimeSelect" 
                                    value={ot.id} 
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedOvertimeIds(prev => [...prev, ot.id]);
                                      } else {
                                        setSelectedOvertimeIds(prev => prev.filter(id => id !== ot.id));
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 cursor-pointer"
                                  />
                                  <div>
                                    <div className="text-sm font-bold text-gray-900 mb-0.5">{ot.title}</div>
                                    <div className="text-xs text-gray-600 flex items-center gap-1">
                                       <CalendarIcon className="w-3 h-3"/> {ot.work_date}
                                       <span className="text-gray-300">|</span>
                                       {ot.start_time?.slice(0,5)}~{ot.end_time?.slice(0,5)}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-[200px] mt-1">{ot.reason}</div>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 pl-2">
                                  <div className="text-sm font-bold text-blue-600">
                                    잔여 {remaining}시간
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    총 {ot.recognized_hours}h
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      
                      {isSelectionValid ? (
                        <p className="text-xs text-blue-700 mt-2 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {requestType === 'cancel' 
                             ? "취소 시 사용했던 시간이 반환됩니다." 
                             : `선택 완료! 신청하려는 ${currentReqHours}시간이 정상적으로 차감됩니다.`}
                        </p>
                      ) : (
                        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          필요한 시간({currentReqHours}시간)을 채우기 위해 초과근무를 더 선택해주세요.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isFormDisabled ? "pointer-events-none grayscale" : ""}`}>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">휴가 기간</label>
                  <div className="flex items-center gap-2">
                    <input type="date" name="startDate" disabled={isFormDisabled} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500" />
                    <span className="text-gray-400">~</span>
                    <input type="date" name="endDate" disabled={isFormDisabled} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">총 사용 연차</label>
                  <div className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-100 rounded-lg h-[42px]">
                    <Calculator className="w-5 h-5 text-blue-500 ml-1" />
                    <div className="flex items-center gap-1 text-sm text-gray-700">
                      <span className="font-bold text-gray-900">{calcResult.duration}</span>일
                      <span className="text-gray-400">×</span>
                      <span className="font-bold text-gray-900">{leaveFactor}</span>
                      <span className="text-gray-400">=</span>
                    </div>
                    <div className="ml-auto bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded shadow-sm">
                      {calcResult.totalDeduction.toFixed(2)}일 {requestType === 'cancel' ? "반환" : "차감"}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isFormDisabled ? "pointer-events-none grayscale" : ""}`}>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">사용 시간 (선택)</label>
                  <div className="flex items-center gap-2">
                    <select 
                      name="startTime" 
                      disabled={isFormDisabled} 
                      value={startTime} 
                      onChange={(e) => setStartTime(e.target.value)} 
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 bg-white"
                    >
                      <option value="">선택 안함</option>
                      {TIME_OPTIONS.map(time => (
                        <option key={`start-${time}`} value={time}>{time}</option>
                      ))}
                    </select>
                    
                    <span className="text-gray-400">~</span>
                    
                    <select 
                      name="endTime" 
                      disabled={isFormDisabled} 
                      value={endTime} 
                      onChange={(e) => setEndTime(e.target.value)} 
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 bg-white"
                    >
                      <option value="">선택 안함</option>
                      {TIME_OPTIONS.map(time => (
                        <option key={`end-${time}`} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    {requestType === 'cancel' ? "취소 사유" : "휴가 사유"}
                  </label>
                  <textarea 
                    name="reason" 
                    disabled={isViewMode} 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)} 
                    placeholder={requestType === 'cancel' ? "취소하시는 사유를 입력해주세요." : ""}
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none text-gray-900 disabled:bg-gray-100 disabled:text-gray-600 placeholder:text-gray-500"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">업무 인수인계</label>
                  <textarea name="handoverNotes" disabled={isFormDisabled} value={handoverNotes} onChange={(e) => setHandoverNotes(e.target.value)} className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none text-gray-900 disabled:bg-gray-100 disabled:text-gray-600"></textarea>
                </div>
              </div>
            </section>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors">
              {isViewMode ? "닫기" : "취소"}
            </button>
            {!isViewMode && (
              <button 
                type="submit" 
                disabled={isSubmitDisabled} 
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                <FileText className="w-4 h-4" />
                {isSubmitting ? "처리 중..." : "결재 상신"}
              </button>
            )}
          </div>
        </form>

        {isApproverSelectOpen && (
          // ... 기존 결재자 선택 모달 코드 유지 ...
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
             <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-64 max-h-[300px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
                <span className="font-bold text-sm text-gray-800">
                  {editingApproverIndex !== null ? "결재자 변경" : "결재자 선택"}
                </span>
                <button type="button" onClick={() => setIsApproverSelectOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <ul className="flex-1 overflow-y-auto p-1">
                {colleagues.map((user) => (
                  <li key={user.id}>
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectApprover(user);
                      }} 
                      className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 rounded-lg flex justify-between items-center group transition-colors border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium text-gray-900">{user.name}</span>
                      <span className="text-gray-500 text-xs bg-gray-100 px-2 py-0.5 rounded-full group-hover:bg-white">{user.rank}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {isLineManagerOpen && (
          // ... 기존 결재선 관리 모달 코드 유지 ...
           <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="px-5 py-4 border-b bg-gray-50 flex justify-between items-center">
               <h4 className="font-bold text-gray-800 flex items-center gap-2">
                 <Bookmark className="w-4 h-4 text-blue-600" /> 나만의 결재선
               </h4>
               <button type="button" onClick={() => setIsLineManagerOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button
>
             </div>
             <div className="p-5 flex-1 overflow-y-auto space-y-6">
               <div>
                 <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">현재 설정 저장</label>
                 <div className="flex gap-2">
                   <input type="text" placeholder="예: 팀장님 전결..." value={newLineTitle} onChange={(e) => setNewLineTitle(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-500" />
                   <button type="button" onClick={handleSaveLine} disabled={approvers.length === 0} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"><Save className="w-4 h-4" /></button>
                 </div>
               </div>
               <div className="h-px bg-gray-100"></div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">불러오기</label>
                 {savedLines.length === 0 ? (
                   <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">저장된 결재선이 없습니다.</div>
                 ) : (
                   <ul className="space-y-2">
                     {savedLines.map((line) => (
                       <li key={line.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group">
                         <div className="flex-1">
                           <div className="font-bold text-sm text-gray-900">{line.title}</div>
                           <div className="text-xs text-gray-600 mt-0.5 flex gap-1">{line.approvers.map((a: any) => a.name).join(" → ")}</div>
                         </div>
                         <div className="flex items-center gap-1">
                           <button type="button" onClick={() => handleApplyLine(line.approvers)} className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><ArrowDownToLine className="w-4 h-4" /></button>
                           <button type="button" onClick={() => handleDeleteLine(line.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                         </div>
                       </li>
                     ))}
                   </ul>
                 )}
               </div>
             </div>
           </div>
         </div>
        )}
      </div>
    </div>
  );
}
