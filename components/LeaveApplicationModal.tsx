"use client";

import { X, Calendar as CalendarIcon, Users, FileText, Plus, CheckCircle2, XCircle, Bookmark, Save, ArrowDownToLine, Trash2, Calculator, Clock, AlertCircle, RefreshCw, FileInput, FilePenLine, FileX2, ChevronRight } from "lucide-react";
import { submitLeaveRequest } from "@/app/actions"; 
import { useState, useEffect, useRef } from "react"; 
import { getApprovers } from "@/app/actions/user"; 
import { getSavedLines, saveLine, deleteLine } from "@/app/actions/approval-line"; 
import { createClient } from "@/utils/supabase/client";

const FALLBACK_LEAVE_OPTIONS = [
  { label: "반반차", days: 0.25 }, { label: "반차", days: 0.50 }, { label: "연차", days: 1.00 },
  { label: "대체휴무_반반일", days: 0.25 }, { label: "대체휴무_반일", days: 0.50 }, { label: "대체휴무_전일", days: 1.00 },
  { label: "특별휴가", days: 0 }, { label: "공가", days: 0 }, { label: "생리휴가", days: 0 },
  { label: "병가", days: 0 }, { label: "태아검진휴가", days: 0 }, { label: "육아휴직", days: 0 },
];

const REQUEST_TYPES = [{ id: "create", label: "신청", icon: FileInput }, { id: "update", label: "변경", icon: FilePenLine }, { id: "cancel", label: "취소", icon: FileX2 }];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${Math.floor(i / 2).toString().padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

const parseIds = (v: any): string[] => {
  if (!v) return []; if (Array.isArray(v)) return v;
  try { return v.startsWith('[') ? JSON.parse(v) : [v]; } catch { return [String(v)]; }
};

const getLatestApprovedItems = (data: any[], parentKey: string) => {
  const itemMap = new Map(data.map(i => [i.id, i]));
  const getRoot = (id: string): string => itemMap.get(id)?.[parentKey] ? getRoot(itemMap.get(id)[parentKey]) : id;
  const groups = data.reduce((acc: any, i) => { const r = getRoot(i.id); (acc[r] = acc[r] || []).push(i); return acc; }, {});
  return Object.values(groups).map((g: any) => {
    if (g.some((i: any) => i.status === 'pending')) return null;
    const approved = g.filter((i: any) => i.status === 'approved').sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (!approved.length || approved[0].request_type === 'cancel') return null;
    return approved[0];
  }).filter(Boolean);
};

interface LeaveApplicationModalProps { isOpen: boolean; onClose: () => void; onSuccess?: () => void; initialData?: any; }
interface ApproverUser { id: string; name: string; rank: string; dept: string; status?: string; is_approver?: boolean; }
interface OvertimeRecord { id: string; title: string; work_date: string; start_time: string; end_time: string; total_hours: number; recognized_days: number; recognized_hours: number; used_hours: number; reason: string; status?: string; request_type?: string; original_overtime_request_id?: string; created_at?: string; }
interface LeaveRecord { id: string; leave_type: string; start_date: string; end_date: string; start_time?: string; end_time?: string; total_days: number; reason: string; handover_notes?: string; status: string; created_at: string; overtime_request_id?: string; overtime_request_ids?: string; }

export default function LeaveApplicationModal({ isOpen, onClose, onSuccess, initialData }: LeaveApplicationModalProps) {
  const supabase = createClient();
  const isViewMode = !!initialData;
  const isSubmittingRef = useRef(false);

  const [leaveOptions, setLeaveOptions] = useState<{label: string, days: number}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [selectedLeaveType, setSelectedLeaveType] = useState("연차"); const [leaveFactor, setLeaveFactor] = useState(1.0);
  const [calcResult, setCalcResult] = useState({ duration: 0, totalDeduction: 0 });
  const [reason, setReason] = useState(""); const [handoverNotes, setHandoverNotes] = useState("");
  const [startTime, setStartTime] = useState(""); const [endTime, setEndTime] = useState("");

  const [overtimeList, setOvertimeList] = useState<OvertimeRecord[]>([]);
  const [selectedOvertimeIds, setSelectedOvertimeIds] = useState<string[]>([]);
  const [linkedOvertimes, setLinkedOvertimes] = useState<OvertimeRecord[]>([]);
  const [usageRecords, setUsageRecords] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) { setIsApproverSelectOpen(false); setIsLineManagerOpen(false); setEditingApproverIndex(null); return; }
    isSubmittingRef.current = false; setIsSubmitting(false);

    const initializeData = async () => {
      const { data: typeData } = await supabase.from("leave_types").select("*").eq("is_active", true).order("sort_order", { ascending: true });
      const loadedOptions = typeData?.length ? typeData.map(d => ({ label: d.name, days: Number(d.deduction_days) })) : FALLBACK_LEAVE_OPTIONS;
      setLeaveOptions(loadedOptions);

      if (isViewMode && initialData?.id) {
        setStartDate(initialData.start_date); setEndDate(initialData.end_date);
        setSelectedLeaveType(initialData.leave_type); setReason(initialData.reason || "");
        setHandoverNotes(initialData.handover_notes || "");
        setStartTime(initialData.start_time?.slice(0, 5) || ""); setEndTime(initialData.end_time?.slice(0, 5) || "");
        setRequestType(initialData.request_type || "create");
        setLeaveFactor(loadedOptions.find(opt => opt.label === initialData.leave_type)?.days || 0);

        if (initialData.original_leave_request_id) {
          supabase.from("leave_requests").select("*").eq("id", initialData.original_leave_request_id).maybeSingle()
            .then(({ data }) => { if (data) { setOriginalLeaveForView(data); setSelectedOriginalLeaveId(data.id); } });
        }

        const otIds = parseIds(initialData.overtime_request_ids || initialData.overtime_request_id);
        if (otIds.length > 0) {
          supabase.from("overtime_requests").select("*").in("id", otIds).then(({ data }) => setLinkedOvertimes(data || []));
          const targetLeaveId = initialData.request_type === 'cancel' ? initialData.original_leave_request_id : initialData.id;
          if (targetLeaveId) supabase.from("leave_overtime_usage").select("*").eq("leave_request_id", targetLeaveId).then(({ data }) => setUsageRecords(data || []));
        }

        supabase.from("approval_lines").select("*").eq("leave_request_id", initialData.id).order("step_order", { ascending: true })
          .then(async ({ data: lines }) => {
            if (!lines) return;
            const { data: profiles } = await supabase.from("profiles").select("id, name, position, department").in("id", lines.map(l => l.approver_id));
            setApprovers(lines.map(line => {
              const p = profiles?.find(p => p.id === line.approver_id);
              return { id: line.approver_id, name: p?.name || "알수없음", rank: p?.position || "-", dept: p?.department || "-", status: line.status };
            }));
          });
      } else {
        getApprovers().then(setColleagues);
        setApprovers([]); setStartDate(""); setEndDate(""); 
        setLeaveFactor(loadedOptions[0]?.days || 1.0); setSelectedLeaveType(loadedOptions[0]?.label || "연차");
        setReason(""); setHandoverNotes(""); setStartTime(""); setEndTime(""); setCalcResult({ duration: 0, totalDeduction: 0 });
        setOvertimeList([]); setSelectedOvertimeIds([]); setLinkedOvertimes([]); setUsageRecords([]); setEditingApproverIndex(null);
        setRequestType("create"); setSelectedOriginalLeaveId(""); setApprovedLeaves([]); setOriginalLeaveForView(null);
      }
    };
    initializeData();
  }, [isOpen, isViewMode, initialData, supabase]);

  useEffect(() => {
    if (isViewMode || !isOpen) return;
    setSelectedOriginalLeaveId(""); setStartDate(""); setEndDate(""); setStartTime(""); setEndTime("");
    setReason(""); setHandoverNotes(""); setSelectedOvertimeIds([]); setLinkedOvertimes([]); setUsageRecords([]);
    
    if (leaveOptions.length > 0) { setSelectedLeaveType(leaveOptions[0].label); setLeaveFactor(leaveOptions[0].days); }
    if (requestType === 'update' || requestType === 'cancel') {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return;
        const { data } = await supabase.from("leave_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (data) setApprovedLeaves(getLatestApprovedItems(data, 'original_leave_request_id'));
      });
    }
  }, [requestType, isOpen, isViewMode, supabase, leaveOptions]);

  useEffect(() => {
    if (selectedLeaveType.startsWith("대체휴무") && !isViewMode && isOpen) {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return;
        const [{ data: otData }, { data: pendingLeaves }] = await Promise.all([
          supabase.from("overtime_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("leave_requests").select("*").eq("user_id", user.id).eq("status", "pending")
        ]);
        const lockedOtIds = new Set<string>();
        pendingLeaves?.forEach(leave => parseIds(leave.overtime_request_ids || leave.overtime_request_id).forEach(id => lockedOtIds.add(id)));
        if (otData) {
          const validOvertimes = getLatestApprovedItems(otData, 'original_overtime_request_id')
            .filter(ot => ((ot.recognized_hours || 0) - (ot.used_hours || 0)) > 0 && !lockedOtIds.has(ot.id))
            .sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());
          setOvertimeList(validOvertimes);
        }
      });
    } else if (!isViewMode) { setOvertimeList([]); setSelectedOvertimeIds([]); }
  }, [selectedLeaveType, isOpen, isViewMode, supabase]);

  useEffect(() => {
    if (startDate && endDate) {
      const diffDays = Math.max(0, (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000 + 1);
      setCalcResult({ duration: Math.floor(diffDays), totalDeduction: diffDays * leaveFactor });
    } else setCalcResult({ duration: 0, totalDeduction: 0 });
  }, [startDate, endDate, leaveFactor]);

  useEffect(() => { if (isLineManagerOpen) getSavedLines().then(setSavedLines); }, [isLineManagerOpen]);
  
  const handleSaveLine = async () => { 
    if (!newLineTitle.trim()) return alert("결재선 이름을 입력해주세요.");
    if (!approvers.length) return alert("저장할 결재자가 없습니다.");
    const res = await saveLine(newLineTitle, approvers);
    if (res.error) alert(res.error); else { setNewLineTitle(""); getSavedLines().then(setSavedLines); }
  };

  const handleSelectOriginalLeave = async (leave: LeaveRecord) => {
    setSelectedOriginalLeaveId(leave.id); setStartDate(leave.start_date); setEndDate(leave.end_date);
    setSelectedLeaveType(leave.leave_type); setStartTime(leave.start_time?.slice(0, 5) || ""); setEndTime(leave.end_time?.slice(0, 5) || "");
    setHandoverNotes(leave.handover_notes || ""); setReason(requestType === 'cancel' ? "" : (leave.reason || ""));
    const otIds = parseIds(leave.overtime_request_ids || leave.overtime_request_id);
    setSelectedOvertimeIds(otIds);
    setLeaveFactor(leaveOptions.find(opt => opt.label === leave.leave_type)?.days || 1.0);

    if (otIds.length > 0) {
      const [{ data: otData }, { data: usageData }] = await Promise.all([
        supabase.from("overtime_requests").select("*").in("id", otIds),
        supabase.from("leave_overtime_usage").select("*").eq("leave_request_id", leave.id)
      ]);
      setLinkedOvertimes(otData || []); setUsageRecords(usageData || []);
    } else { setLinkedOvertimes([]); setUsageRecords([]); }
  };

  const handleSelectApprover = (user: ApproverUser) => {
    if (isViewMode) return;
    if (approvers.some((a, i) => a.id === user.id && i !== editingApproverIndex)) return alert("이미 추가된 결재자입니다.");
    const newApprovers = [...approvers];
    if (editingApproverIndex !== null) newApprovers[editingApproverIndex] = user;
    else { if (approvers.length >= 2) return alert("결재자는 최대 2명까지만 지정 가능합니다."); newApprovers.push(user); }
    setApprovers(newApprovers); setIsApproverSelectOpen(false); setEditingApproverIndex(null);
  };

  async function handleSubmit(formData: FormData) {
    if (isViewMode || isSubmittingRef.current) return;
    if (approvers.length === 0) return alert("최소 1명 이상의 결재자를 지정해야 합니다.");
    if ((requestType === 'update' || requestType === 'cancel') && !selectedOriginalLeaveId) return alert("대상 연차 내역을 선택해주세요.");

    if (selectedLeaveType.startsWith("대체휴무") && requestType !== 'cancel') {
      if (!selectedOvertimeIds.length) return alert("대체휴무 정보가 올바르지 않습니다.");
      const requiredHours = (calcResult.totalDeduction || leaveFactor) * 8;
      if (totalSelectedRemaining < requiredHours) return alert(`잔여 시간(${totalSelectedRemaining}h)이 부족합니다.`);
    }

    isSubmittingRef.current = true; setIsSubmitting(true);
    try {
      const result = await submitLeaveRequest(formData);
      if (result?.error) throw new Error(result.error);
      alert("결재가 성공적으로 상신되었습니다! 🎉"); onSuccess?.(); onClose();
    } catch (error: any) { alert(`오류 발생: ${error.message || "알 수 없는 오류"}`); } 
    finally { isSubmittingRef.current = false; setIsSubmitting(false); }
  }

  if (!isOpen) return null;

  const isCompensatory = selectedLeaveType.startsWith("대체휴무");
  const currentReqHours = (calcResult.totalDeduction || leaveFactor) * 8;
  const totalSelectedRemaining = overtimeList.filter(ot => selectedOvertimeIds.includes(ot.id)).reduce((sum, ot) => sum + ((ot.recognized_hours || 0) - (ot.used_hours || 0)), 0);
  const isSelectionValid = requestType === 'cancel' || (selectedOvertimeIds.length > 0 && totalSelectedRemaining >= currentReqHours);
  const isFormDisabled = isViewMode || requestType === 'cancel';
  const isSubmitDisabled = isSubmitting || !approvers.length || ((requestType === 'update' || requestType === 'cancel') && !selectedOriginalLeaveId);
  const approverColleagues = colleagues.filter(u => u.is_approver);

  const selectedOriginalLeave = approvedLeaves.find(l => l.id === selectedOriginalLeaveId);
  const isOriginalCompensatory = selectedOriginalLeave?.leave_type.startsWith("대체휴무");
  const isLeaveTypeDisabled = isFormDisabled || (requestType === 'update' && isOriginalCompensatory);

  const labelBase = "block text-sm font-bold text-gray-800 mb-2";
  const inputBase = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500";
  
  const renderTimeSelect = (name: string, value: string, setter: (v: string) => void) => (
    <select name={name} disabled={isFormDisabled} value={value} onChange={(e) => setter(e.target.value)} className={`flex-1 bg-white ${inputBase}`}>
      <option value="">선택 안함</option>
      {TIME_OPTIONS.map(time => <option key={`${name}-${time}`} value={time}>{time}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" /> {isViewMode ? "연차 신청서 상세" : "연차 신청서 작성"}</h2>
            <p className="text-xs text-gray-600 mt-1">문서번호: {isViewMode ? `LEAVE-${initialData.id.slice(0, 8)}` : "자동생성 (임시저장)"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>

        <form action={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <input type="hidden" name="approversJson" value={JSON.stringify(approvers)} />
          <input type="hidden" name="totalLeaveDays" value={calcResult.totalDeduction} />
          <input type="hidden" name="overtimeRequestIds" value={JSON.stringify(selectedOvertimeIds)} />
          <input type="hidden" name="requestType" value={requestType} />
          <input type="hidden" name="originalLeaveId" value={selectedOriginalLeaveId} />
          {requestType === 'cancel' && (
            <><input type="hidden" name="startDate" value={startDate} /><input type="hidden" name="endDate" value={endDate} /><input type="hidden" name="leaveType" value={selectedLeaveType} /><input type="hidden" name="startTime" value={startTime} /><input type="hidden" name="endTime" value={endTime} /></>
          )}

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <section>
               <div className="flex justify-between items-center mb-3">
                <h3 className={`${labelBase} !mb-0 flex items-center gap-2`}><Users className="w-4 h-4" /> {isViewMode ? "결재 진행 현황" : "결재선 지정"}</h3>
                {!isViewMode && <button type="button" onClick={() => setIsLineManagerOpen(true)} className="text-xs flex items-center gap-1 text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"><Bookmark className="w-3 h-3" /> 나만의 결재선</button>}
              </div>
              <div className="flex items-center gap-3 overflow-x-auto pb-2 relative">
                <div className="min-w-[100px] p-3 border border-blue-200 bg-blue-50 rounded-lg text-center shrink-0">
                  <div className="text-xs text-blue-600 font-bold mb-1">기안</div><div className="text-sm font-bold text-gray-900">나 (본인)</div><div className="text-xs text-gray-600">신청완료</div>
                </div>
                <div className="text-gray-400">→</div>
                {approvers.map((app, idx) => (
                  <div key={app.id} className="flex items-center gap-3">
                    <div onClick={() => !isViewMode && (setEditingApproverIndex(idx), setIsApproverSelectOpen(true))} className={`min-w-[100px] p-3 border rounded-lg text-center relative group shrink-0 transition-all ${app.status === 'approved' ? 'bg-blue-50 border-blue-300' : app.status === 'rejected' ? 'bg-red-50 border-red-300' : !isViewMode ? 'bg-white border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer' : 'bg-white border-blue-200'}`}>
                      <div className="text-xs text-gray-600 mb-1 flex justify-center items-center gap-1">결재 ({idx + 1}차) {isViewMode && (app.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-blue-600" /> : app.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-600" /> : <span className="text-[10px] text-gray-500">대기</span>)}</div>
                      <div className="text-sm font-bold text-gray-900">{app.name}</div><div className="text-xs text-gray-600">{app.rank}</div>
                      {!isViewMode && <div className="absolute inset-0 flex items-center justify-center bg-white/80 opacity-0 group-hover:opacity-100 rounded-lg"><span className="text-xs font-bold text-blue-600 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> 변경</span></div>}
                      {!isViewMode && <button type="button" onClick={(e) => { e.stopPropagation(); setApprovers(approvers.filter((_, i) => i !== idx)); }} className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-200 z-10"><X className="w-3 h-3" /></button>}
                    </div>
                    {idx < approvers.length - 1 && <div className="text-gray-400">→</div>}
                  </div>
                ))}
                {!isViewMode && approvers.length < 2 && (
                  <>{approvers.length > 0 && <div className="text-gray-400">→</div>}
                  <button type="button" onClick={() => { setEditingApproverIndex(null); setIsApproverSelectOpen(true); }} className="min-w-[100px] p-3 border border-dashed border-gray-300 rounded-lg text-center hover:border-blue-400 hover:bg-blue-50 flex flex-col items-center justify-center gap-1 shrink-0"><Plus className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500 font-medium">결재자 추가</span></button></>
                )}
              </div>
            </section>

            <hr className="border-gray-100" />

            <section className="space-y-6 pointer-events-auto">
              <div>
                <label className={labelBase}>신청 유형</label>
                <div className="flex gap-4">
                  {REQUEST_TYPES.map(type => (
                    <label key={type.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all flex-1 justify-center ${requestType === type.id ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500 text-blue-700" : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"} ${isViewMode ? "cursor-default opacity-80" : ""}`}>
                      <input type="radio" name="requestTypeRadio" value={type.id} checked={requestType === type.id} disabled={isViewMode} onChange={() => setRequestType(type.id)} className="hidden" />
                      <type.icon className={`w-4 h-4 ${requestType === type.id ? "text-blue-600" : "text-gray-400"}`} />
                      <span className="text-sm font-bold">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(requestType === 'update' || requestType === 'cancel') && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className={labelBase}>{requestType === 'update' ? "변경 대상 연차" : "취소 대상 연차"} {isViewMode && <span className="text-xs font-normal text-gray-500 ml-2">(원본 데이터)</span>}</label>
                  {isViewMode ? (
                    originalLeaveForView ? (
                      <div className="p-4 rounded-lg border bg-gray-50 flex items-center justify-between">
                        <div>
                          <div className="flex gap-2 mb-1"><span className="text-xs font-bold bg-white border px-1.5 py-0.5 rounded">{originalLeaveForView.leave_type}</span><span className="text-xs text-gray-500">{new Date(originalLeaveForView.created_at).toLocaleDateString()} 신청분</span></div>
                          <div className="text-sm font-bold flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5 text-gray-500" /> {originalLeaveForView.start_date} ~ {originalLeaveForView.end_date} <span className="text-xs font-normal text-gray-600">({originalLeaveForView.total_days}일)</span></div>
                        </div>
                        <div className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border">원본</div>
                      </div>
                    ) : <div className="text-sm text-gray-500 p-3 border rounded bg-gray-50">원본 연차 정보를 불러올 수 없습니다.</div>
                  ) : (
                    <><div className="border rounded-lg bg-gray-50 p-4 max-h-60 overflow-y-auto space-y-2">
                        {approvedLeaves.length === 0 ? <div className="text-center text-sm text-gray-500 py-4">선택 가능한 승인된 연차 내역이 없습니다.</div> : approvedLeaves.map(leave => (
                          <div key={leave.id} onClick={() => handleSelectOriginalLeave(leave)} className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between group ${selectedOriginalLeaveId === leave.id ? "bg-blue-100 border-blue-500 ring-1 ring-blue-500" : "bg-white hover:border-blue-300 hover:shadow-sm"}`}>
                            <div>
                              <div className="flex gap-2 mb-1"><span className="text-xs font-bold bg-gray-100 px-1.5 py-0.5 rounded">{leave.leave_type}</span><span className="text-xs text-gray-500">{new Date(leave.created_at).toLocaleDateString()} 신청</span></div>
                              <div className="text-sm font-bold flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5 text-gray-500" /> {leave.start_date} ~ {leave.end_date} <span className="text-xs font-normal text-gray-600">({leave.total_days}일)</span></div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100" />
                          </div>
                        ))}
                      </div>
                      {selectedOriginalLeaveId && <p className="text-xs text-blue-600 mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {requestType === 'update' ? "선택한 연차 정보가 적용되었습니다. 내용을 수정 후 결재를 상신하세요." : "선택한 연차를 취소합니다. 아래에 취소 사유를 입력해주세요."}</p>}
                    </>
                  )}
                </div>
              )}

              <div className={isLeaveTypeDisabled ? "pointer-events-none grayscale opacity-70" : ""}>
                <label className={labelBase}>
                  휴가 종류
                  {requestType === 'update' && isOriginalCompensatory && <span className="text-xs text-red-500 font-normal ml-2 tracking-tight">* 대체휴무는 휴가 종류를 변경할 수 없습니다. (취소 후 재신청 요망)</span>}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {leaveOptions.map(opt => {
                    const isSelected = isViewMode ? initialData?.leave_type === opt.label : selectedLeaveType === opt.label;
                    return (
                      <label key={opt.label} className={`flex items-center justify-between p-3 border rounded-lg transition-all ${isSelected ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:bg-gray-50'} ${isViewMode && !isSelected ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                          <input type="radio" name="leaveType" value={opt.label} required disabled={isLeaveTypeDisabled} checked={isSelected} onChange={() => { setLeaveFactor(opt.days); setSelectedLeaveType(opt.label); }} className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="text-sm text-gray-900 truncate font-medium">{opt.label}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${opt.days > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{opt.days > 0 ? `-${opt.days.toFixed(2)}` : '0.0'}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {isCompensatory && (
                <div className={`border rounded-lg p-4 animate-in fade-in slide-in-from-top-2 ${isViewMode ? 'bg-gray-50' : requestType === 'cancel' ? 'bg-green-50 border-green-200 pointer-events-none' : requestType === 'update' ? 'bg-blue-50 border-blue-200 pointer-events-none' : isSelectionValid ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><Clock className={`w-5 h-5 ${isSelectionValid || isViewMode || requestType === 'cancel' || requestType === 'update' ? 'text-blue-600' : 'text-gray-600'}`} /><h4 className={`text-sm font-bold ${isSelectionValid || isViewMode || requestType === 'cancel' || requestType === 'update' ? 'text-blue-800' : 'text-gray-800'}`}>{isViewMode || requestType === 'cancel' || requestType === 'update' ? "사용된 보상 휴가 원천" : "보상 휴가 원천 선택"}</h4></div>
                    {!(isViewMode || requestType === 'cancel' || requestType === 'update') && <div className={`text-xs font-bold px-3 py-1.5 rounded-full border ${isSelectionValid ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-600 border-red-200'}`}>모은 시간: {totalSelectedRemaining}h / 필요 시간: {currentReqHours}h</div>}
                  </div>
                  
                  {isViewMode || requestType === 'cancel' || requestType === 'update' ? (
                    linkedOvertimes.length > 0 ? (() => {
                      const orderedOtIds = isViewMode ? parseIds(initialData?.overtime_request_ids || initialData?.overtime_request_id) : selectedOvertimeIds;
                      const sortedOvertimes = [...linkedOvertimes].sort((a, b) => orderedOtIds.indexOf(a.id) - orderedOtIds.indexOf(b.id));
                      let remDeduct = isViewMode ? (initialData?.deducted_hours || (initialData?.total_leave_days * 8) || 0) : (calcResult.totalDeduction * 8 || leaveFactor * 8);

                      return sortedOvertimes.map(ot => {
                        const usage = usageRecords.find(u => u.overtime_request_id === ot.id);
                        const avail = (ot.recognized_hours || 0) - (ot.used_hours || 0);
                        let usedText = "", badgeClass = "";
                        const subText = `현재 잔여 ${avail}h / 총 ${ot.recognized_hours}h`;
                        
                        // ⭐️ 수정됨: 취소 관련 상태를 3가지로 정교하게 분리
                        // 1. 완전 취소 완료 (원본이 cancelled 상태이거나, 취소신청서가 최종 approved 된 경우)
                        const isFullyCancelled = isViewMode && (initialData?.status === 'cancelled' || (initialData?.request_type === 'cancel' && initialData?.status === 'approved'));
                        // 2. 취소 결재 진행 중 (취소신청서가 pending 인 경우)
                        const isPendingCancel = isViewMode && initialData?.request_type === 'cancel' && initialData?.status === 'pending';
                        // 3. 취소 결재 반려 (취소신청서가 rejected 인 경우)
                        const isRejectedCancel = isViewMode && initialData?.request_type === 'cancel' && initialData?.status === 'rejected';

                        if (isFullyCancelled) {
                          usedText = usage ? `${usage.used_hours}시간 환급완료` : "취소됨 (환급완료)"; 
                          badgeClass = usage ? "bg-gray-100 text-gray-700" : "bg-gray-100 text-gray-500 line-through";
                        } else if (isPendingCancel) {
                          usedText = usage ? `${usage.used_hours}시간 반환 대기중` : "반환 대기중"; 
                          badgeClass = "bg-yellow-100 text-yellow-700"; // 노란색 배지
                        } else if (isRejectedCancel) {
                          usedText = "취소 반려됨"; 
                          badgeClass = "bg-red-100 text-red-600";
                        } else if (isViewMode && initialData?.status === 'rejected') {
                          usedText = "반려됨"; 
                          badgeClass = "bg-red-100 text-red-600";
                        } else if (isViewMode && initialData?.status === 'pending') {
                          const exp = Math.min(avail, remDeduct); remDeduct = Math.max(0, remDeduct - exp);
                          usedText = `${exp}시간 차감 예정`; 
                          badgeClass = "bg-yellow-100 text-yellow-700";
                        } else if (requestType === 'cancel') {
                          usedText = usage ? `${usage.used_hours}시간 반환 예정` : `반환 예정`; 
                          badgeClass = "bg-green-100 text-green-700";
                        } else if (requestType === 'update') {
                          usedText = usage ? `기존 ${usage.used_hours}시간 승계` : `승계 예정`; 
                          badgeClass = "bg-blue-100 text-blue-700";
                        } else {
                          usedText = usage ? `${usage.used_hours}시간 차감` : `총 ${ot.recognized_hours}시간`; 
                          badgeClass = usage ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700";
                        }
                        
                        return (
                          <div key={ot.id} className="bg-white p-3 border rounded-lg shadow-sm mb-2 flex justify-between items-center">
                            <div><div className="text-sm font-bold mb-0.5">{ot.title}</div><div className="text-xs text-gray-500 flex gap-1"><CalendarIcon className="w-3 h-3"/> {ot.work_date} | {ot.start_time?.slice(0,5)}~{ot.end_time?.slice(0,5)}</div></div>
                            <div className="text-right flex flex-col items-end gap-1"><span className={`px-2 py-1 rounded text-xs font-bold ${badgeClass}`}>{usedText}</span><span className="text-[10px] text-gray-500 font-medium">{subText}</span></div>
                          </div>
                        );
                      });
                    })() : <div className="text-sm text-gray-400 p-2">연결된 초과근무 정보를 불러올 수 없습니다.</div>
                  ) : (
                    <>{overtimeList.length === 0 ? <div className="text-sm text-gray-500 bg-white p-3 rounded border text-center">사용 가능한 승인된 초과근무 내역이 없습니다.</div> : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {overtimeList.map(ot => {
                            const remaining = (ot.recognized_hours || 0) - (ot.used_hours || 0);
                            const isSelected = selectedOvertimeIds.includes(ot.id);
                            return (
                              <label key={ot.id} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${isSelected ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-500' : 'bg-white hover:bg-gray-50'}`}>
                                <div className="flex items-center gap-3">
                                  <input type="checkbox" value={ot.id} checked={isSelected} onChange={(e) => {
                                      if (e.target.checked) {
                                        if (totalSelectedRemaining >= currentReqHours) return alert(`이미 필요한 시간(${currentReqHours}시간)을 모두 채웠습니다.`);
                                        setSelectedOvertimeIds(prev => [...prev, ot.id]);
                                      } else setSelectedOvertimeIds(prev => prev.filter(id => id !== ot.id));
                                    }} className="w-4 h-4 text-blue-600 shrink-0" />
                                  <div><div className="text-sm font-bold mb-0.5">{ot.title}</div><div className="text-xs text-gray-600 flex gap-1"><CalendarIcon className="w-3 h-3"/> {ot.work_date} | {ot.start_time?.slice(0,5)}~{ot.end_time?.slice(0,5)}</div></div>
                                </div>
                                <div className="text-right shrink-0 pl-2"><div className="text-sm font-bold text-blue-600">잔여 {remaining}시간</div><div className="text-xs text-gray-500">총 {ot.recognized_hours}h</div></div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {isSelectionValid ? <p className="text-xs text-blue-700 mt-2 flex items-center gap-1 font-medium"><CheckCircle2 className="w-3 h-3" /> {requestType === 'cancel' ? "취소 시 사용했던 시간이 반환됩니다." : `선택 완료! 신청하려는 ${currentReqHours}시간이 정상적으로 차감됩니다.`}</p> : <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 필요한 시간({currentReqHours}시간)을 채우기 위해 초과근무를 더 선택해주세요.</p>}
                    </>
                  )}
                </div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isFormDisabled ? "pointer-events-none grayscale" : ""}`}>
                <div>
                  <label className={labelBase}>휴가 기간</label>
                  <div className="flex items-center gap-2">
                    <input type="date" name="startDate" disabled={isFormDisabled} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputBase} />
                    <span className="text-gray-400">~</span>
                    <input type="date" name="endDate" disabled={isFormDisabled} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputBase} />
                  </div>
                </div>
                <div>
                  <label className={labelBase}>총 사용 연차</label>
                  <div className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-100 rounded-lg h-[42px]">
                    <Calculator className="w-5 h-5 text-blue-500 ml-1" />
                    <div className="flex items-center gap-1 text-sm text-gray-700"><span className="font-bold text-gray-900">{calcResult.duration}</span>일<span className="text-gray-400">×</span><span className="font-bold text-gray-900">{leaveFactor}</span><span className="text-gray-400">=</span></div>
                    <div className="ml-auto bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded shadow-sm">{calcResult.totalDeduction.toFixed(2)}일 {requestType === 'cancel' ? "반환" : "차감"}</div>
                  </div>
                </div>
                <div>
                  <label className={labelBase}>사용 시간 (선택)</label>
                  <div className="flex items-center gap-2">
                    {renderTimeSelect("startTime", startTime, setStartTime)}
                    <span className="text-gray-400">~</span>
                    {renderTimeSelect("endTime", endTime, setEndTime)}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelBase}>{requestType === 'cancel' ? "취소 사유" : "휴가 사유"}</label>
                  <textarea name="reason" disabled={isViewMode} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={requestType === 'cancel' ? "취소하시는 사유를 입력해주세요." : ""} className={`${inputBase} h-24 resize-none`}></textarea>
                </div>
                <div>
                  <label className={labelBase}>업무 인수인계</label>
                  <textarea name="handoverNotes" disabled={isFormDisabled} value={handoverNotes} onChange={(e) => setHandoverNotes(e.target.value)} className={`${inputBase} h-24 resize-none`}></textarea>
                </div>
              </div>
            </section>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">{isViewMode ? "닫기" : "취소"}</button>
            {!isViewMode && <button type="submit" disabled={isSubmitDisabled} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><FileText className="w-4 h-4" /> {isSubmitting ? "처리 중..." : "결재 상신"}</button>}
          </div>
        </form>

        {/* 결재자 선택 모달 */}
        {isApproverSelectOpen && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
             <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-64 max-h-[300px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center"><span className="font-bold text-sm text-gray-800">{editingApproverIndex !== null ? "결재자 변경" : "결재자 선택"}</span><button type="button" onClick={() => setIsApproverSelectOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button></div>
              <ul className="flex-1 overflow-y-auto p-1">
                {approverColleagues.map(user => (
                  <li key={user.id}><button type="button" onClick={(e) => { e.stopPropagation(); handleSelectApprover(user); }} className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 rounded-lg flex justify-between items-center group border-b border-gray-50 last:border-0"><span className="font-medium text-gray-900">{user.name}</span><span className="text-gray-500 text-xs bg-gray-100 px-2 py-0.5 rounded-full group-hover:bg-white">{user.rank}</span></button></li>
                ))}
                {approverColleagues.length === 0 && <li className="text-center py-4 text-xs text-gray-500">선택 가능한 결재권자가 없습니다.</li>}
              </ul>
            </div>
          </div>
        )}

        {/* 나만의 결재선 모달 */}
        {isLineManagerOpen && (
           <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="px-5 py-4 border-b bg-gray-50 flex justify-between items-center"><h4 className="font-bold text-gray-800 flex items-center gap-2"><Bookmark className="w-4 h-4 text-blue-600" /> 나만의 결재선</h4><button type="button" onClick={() => setIsLineManagerOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
             <div className="p-5 flex-1 overflow-y-auto space-y-6">
               <div>
                 <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">현재 설정 저장</label>
                 <div className="flex gap-2">
                   <input type="text" placeholder="예: 팀장님 전결..." value={newLineTitle} onChange={(e) => setNewLineTitle(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                   <button type="button" onClick={handleSaveLine} disabled={approvers.length === 0} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"><Save className="w-4 h-4" /></button>
                 </div>
               </div>
               <div className="h-px bg-gray-100"></div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">불러오기</label>
                 {savedLines.length === 0 ? <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed">저장된 결재선이 없습니다.</div> : (
                   <ul className="space-y-2">
                     {savedLines.map(line => (
                       <li key={line.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm group">
                         <div className="flex-1"><div className="font-bold text-sm">{line.title}</div><div className="text-xs text-gray-600 mt-0.5">{line.approvers.map((a: any) => a.name).join(" → ")}</div></div>
                         <div className="flex items-center gap-1">
                           <button type="button" onClick={() => confirm("결재자가 초기화되고 선택한 결재선이 적용됩니다.") && (setApprovers(line.approvers), setIsLineManagerOpen(false))} className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><ArrowDownToLine className="w-4 h-4" /></button>
                           <button type="button" onClick={() => confirm("정말 삭제하시겠습니까?") && deleteLine(line.id).then(() => getSavedLines().then(setSavedLines))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
