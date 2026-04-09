"use client";

import { useState, useEffect, useRef } from "react";
import { X, Clock, Users, Plus, Trash2, CheckCircle2, XCircle, Bookmark, Save, ArrowDownToLine, Calculator, AlertCircle, RefreshCw, FileInput, FilePenLine, FileX2, Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { submitOvertimeRequest } from "@/app/actions/overtime";
import { getApprovers } from "@/app/actions/user";
import { getSavedLines, saveLine, deleteLine } from "@/app/actions/approval-line";
import { createClient } from "@/utils/supabase/client";

// --- 상수 및 유틸리티 ---
const REQUEST_TYPES = [
  { id: "create", label: "신청", icon: FileInput },
  { id: "update", label: "변경", icon: FilePenLine },
  { id: "cancel", label: "취소", icon: FileX2 },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${Math.floor(i / 2).toString().padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

const getLatestApprovedItems = (data: any[], parentKey: string, extraFilter: (item: any) => boolean = () => true) => {
  const itemMap = new Map(data.map(item => [item.id, item]));
  const getRoot = (id: string): string => itemMap.get(id)?.[parentKey] ? getRoot(itemMap.get(id)[parentKey]) : id;
  
  const groups = data.reduce((acc: any, item) => {
    const root = getRoot(item.id);
    (acc[root] = acc[root] || []).push(item);
    return acc;
  }, {});

  return Object.values(groups)
    .map((g: any) => g.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0])
    .filter((latest: any) => latest.status === 'approved' && latest.request_type !== 'cancel' && extraFilter(latest));
};

const safeParsePlan = (data: any) => {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return parsed.map((row: any) => ({ ...row, startTime: row.startTime?.slice(0, 5) || "", endTime: row.endTime?.slice(0, 5) || "" }));
  } catch { return [{ id: 1, startTime: "", endTime: "", content: "" }]; }
};

// --- 타입 정의 ---
interface OvertimeApplicationModalProps { isOpen: boolean; onClose: () => void; onSuccess?: () => void; initialData?: any; }
interface ApproverUser { id: string; name: string; rank: string; dept: string; status?: string; is_approver?: boolean; }
interface OvertimeRecord { id: string; title: string; work_date: string; start_time: string; end_time: string; total_hours: number; recognized_hours: number; location?: string; reason: string; plan_details?: any; is_holiday: boolean; created_at: string; status: string; request_type?: string; original_overtime_request_id?: string; used_hours?: number; }

export default function OvertimeApplicationModal({ isOpen, onClose, onSuccess, initialData }: OvertimeApplicationModalProps) {
  const supabase = createClient();
  const isViewMode = !!initialData;
  const isSubmittingRef = useRef(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colleagues, setColleagues] = useState<ApproverUser[]>([]);
  const [approvers, setApprovers] = useState<ApproverUser[]>([]);
  const [isApproverSelectOpen, setIsApproverSelectOpen] = useState(false);
  const [isLineManagerOpen, setIsLineManagerOpen] = useState(false);
  const [editingApproverIndex, setEditingApproverIndex] = useState<number | null>(null);
  const [savedLines, setSavedLines] = useState<any[]>([]);
  const [newLineTitle, setNewLineTitle] = useState("");

  const [requestType, setRequestType] = useState("create");
  const [approvedOvertimes, setApprovedOvertimes] = useState<OvertimeRecord[]>([]);
  const [selectedOriginalOtId, setSelectedOriginalOtId] = useState<string>("");
  const [originalOtForView, setOriginalOtForView] = useState<OvertimeRecord | null>(null);

  const [planRows, setPlanRows] = useState([{ id: 1, startTime: "", endTime: "", content: "" }]);
  const [title, setTitle] = useState("");
  const [workDate, setWorkDate] = useState(""); 
  const [isHoliday, setIsHoliday] = useState(false); 
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [totalHours, setTotalHours] = useState("0.0"); 
  const [recognizedHours, setRecognizedHours] = useState(0); 
  const [recognizedDays, setRecognizedDays] = useState("0.00"); 

  // 1. 초기 데이터 로드
  useEffect(() => {
    if (!isOpen) { setIsApproverSelectOpen(false); setIsLineManagerOpen(false); setEditingApproverIndex(null); return; }
    isSubmittingRef.current = false; setIsSubmitting(false);

    if (isViewMode && initialData?.id) {
      setTitle(initialData.title || ""); setWorkDate(initialData.work_date || "");
      setStartTime(initialData.start_time?.slice(0, 5) || ""); setEndTime(initialData.end_time?.slice(0, 5) || "");
      setTotalHours(initialData.total_hours || "0.0"); setIsHoliday(!!initialData.is_holiday);
      setLocation(initialData.location || ""); setReason(initialData.reason || "");
      setRequestType(initialData.request_type || "create");
      
      if (initialData.original_overtime_request_id) {
        setSelectedOriginalOtId(initialData.original_overtime_request_id);
        supabase.from("overtime_requests").select("*").eq("id", initialData.original_overtime_request_id).maybeSingle()
          .then(({ data }) => data && setOriginalOtForView(data));
      }
      if (initialData.plan_details) setPlanRows(safeParsePlan(initialData.plan_details));

      supabase.from("approval_lines").select("*").eq("overtime_request_id", initialData.id).order("step_order", { ascending: true })
        .then(async ({ data: lines }) => {
          if (!lines) return;
          const { data: profiles } = await supabase.from("profiles").select("id, name, position, department").in("id", lines.map(l => l.approver_id));
          setApprovers(lines.map(l => {
            const p = profiles?.find(pf => pf.id === l.approver_id);
            return { id: l.approver_id, name: p?.name || "-", rank: p?.position || "-", dept: p?.department || "-", status: l.status };
          }));
        });
    } else {
      getApprovers().then(setColleagues);
      setApprovers([]); setPlanRows([{ id: 1, startTime: "", endTime: "", content: "" }]);
      const todayStr = new Date().toISOString().split('T')[0];
      setWorkDate(todayStr); setIsHoliday(new Date().getDay() === 0); setTitle(`초과근무신청서_${todayStr}`);
      setStartTime(""); setEndTime(""); setLocation(""); setReason(""); setTotalHours("0.0"); setRecognizedHours(0); setRecognizedDays("0.00");
      setEditingApproverIndex(null); setRequestType("create"); setSelectedOriginalOtId(""); setApprovedOvertimes([]); setOriginalOtForView(null);
    }
  }, [isOpen, isViewMode, initialData, supabase]);

  // 2. 변경/취소 시 원본 초과근무 로드
  useEffect(() => {
    if (!isViewMode && (requestType === 'update' || requestType === 'cancel') && isOpen) {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return;
        const { data } = await supabase.from("overtime_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (data) setApprovedOvertimes(getLatestApprovedItems(data, 'original_overtime_request_id', (ot) => (ot.used_hours || 0) === 0));
      });
      setSelectedOriginalOtId("");
    } else if (requestType === 'create') {
      setReason(""); setSelectedOriginalOtId(""); setApprovedOvertimes([]);
    }
  }, [requestType, isOpen, isViewMode, supabase]);

  // 3. 휴일 및 제목 자동 업데이트
  useEffect(() => {
    if (!isViewMode && workDate && requestType === 'create') {
      setIsHoliday(new Date(workDate).getDay() === 0);
      if (title.startsWith("초과근무신청서_")) setTitle(`초과근무신청서_${workDate}`);
    }
  }, [workDate, isViewMode, requestType]);

  // 4. 시간 및 보상 휴가 계산
  useEffect(() => {
    if (startTime && endTime && workDate) {
      let diff = (new Date(`2000-01-01 ${endTime}`).getTime() - new Date(`2000-01-01 ${startTime}`).getTime()) / 3600000;
      if (diff < 0) diff += 24;
      setTotalHours(diff.toFixed(1));

      const dayOfWeek = new Date(workDate).getDay(); 
      const isWeekendOrHoliday = dayOfWeek === 0 || isHoliday;
      const multiplier = isWeekendOrHoliday ? 2.0 : 1.5;
      const maxCap = isWeekendOrHoliday ? 16 : (dayOfWeek === 6 ? 12 : 999); 

      let finalHours = Math.floor((diff * multiplier) / 2) * 2; 
      if (finalHours > maxCap) finalHours = maxCap;

      setRecognizedHours(finalHours);
      setRecognizedDays((finalHours / 8).toFixed(2));
    } else {
      setTotalHours("0.0"); setRecognizedHours(0); setRecognizedDays("0.00");
    }
  }, [startTime, endTime, workDate, isHoliday]);

  // 결재선 관리
  useEffect(() => { if (isLineManagerOpen) getSavedLines().then(setSavedLines); }, [isLineManagerOpen]);
  const handleSaveLine = async () => { 
    if (!newLineTitle.trim()) return alert("결재선 이름을 입력해주세요.");
    if (!approvers.length) return alert("저장할 결재자가 없습니다.");
    const res = await saveLine(newLineTitle, approvers);
    if (res.error) alert(res.error); else { setNewLineTitle(""); getSavedLines().then(setSavedLines); }
  };

  const handleSelectOriginalOt = (ot: OvertimeRecord) => {
    setSelectedOriginalOtId(ot.id); setTitle(ot.title); setWorkDate(ot.work_date);
    setStartTime(ot.start_time?.slice(0, 5) || ""); setEndTime(ot.end_time?.slice(0, 5) || "");
    setLocation(ot.location || ""); setIsHoliday(ot.is_holiday);
    setPlanRows(safeParsePlan(ot.plan_details));
    setReason(requestType === 'cancel' ? "" : (ot.reason || ""));
  };

  const handleSelectApprover = (user: ApproverUser) => {
    if (isViewMode) return;
    if (approvers.some((a, i) => a.id === user.id && i !== editingApproverIndex)) return alert("이미 추가된 결재자입니다.");
    const newApprovers = [...approvers];
    if (editingApproverIndex !== null) newApprovers[editingApproverIndex] = user;
    else { if (approvers.length >= 2) return alert("최대 2명까지 가능"); newApprovers.push(user); }
    setApprovers(newApprovers); setIsApproverSelectOpen(false); setEditingApproverIndex(null);
  };

  const updatePlanRow = (id: number, field: string, value: string) => !isViewMode && setPlanRows(planRows.map(row => row.id === id ? { ...row, [field]: value } : row));

  async function handleSubmit(formData: FormData) {
    if (isViewMode || isSubmittingRef.current) return;
    if (!approvers.length) return alert("최소 1명 이상의 결재자를 지정해야 합니다.");
    if ((requestType === 'update' || requestType === 'cancel') && !selectedOriginalOtId) return alert("대상 초과근무 내역을 선택해주세요.");

    isSubmittingRef.current = true; setIsSubmitting(true);
    try {
      const result = await submitOvertimeRequest(formData);
      if (result?.error) throw new Error(result.error);
      alert("신청 완료!"); onSuccess?.(); onClose();
    } catch (error: any) {
      alert(error.message || "알 수 없는 오류가 발생했습니다.");
    } finally {
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  // 공통 변수 및 스타일
  const isFormDisabled = isViewMode || requestType === 'cancel';
  const isSubmitDisabled = isSubmitting || !approvers.length || ((requestType === 'update' || requestType === 'cancel') && !selectedOriginalOtId);
  const approverColleagues = colleagues.filter(u => u.is_approver);
  
  const labelBase = "block text-sm font-bold text-gray-800 mb-2";
  const inputBase = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500";

  const renderTimeSelect = (name: string, value: string, setter: (v: string) => void, extraClass: string = "px-3 py-2.5 rounded-lg") => (
    <select name={name} disabled={isFormDisabled} value={value} onChange={(e) => setter(e.target.value)} className={`flex-1 border border-gray-300 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-600 bg-white ${extraClass}`}>
      <option value="">선택</option>
      {TIME_OPTIONS.map(time => <option key={`${name}-${time}`} value={time}>{time}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative">
        
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Clock className="w-6 h-6 text-blue-600" /> {isViewMode ? "초과근무 신청서 상세" : "초과근무 신청서 작성"}</h2>
            <div className="flex gap-3 mt-1 text-xs text-gray-600"><span>문서번호: <span className="text-gray-500">{isViewMode ? `OT-${initialData.id.slice(0,8)}` : "자동생성"}</span></span></div>
          </div>
          <button onClick={onClose}><X className="w-6 h-6 text-gray-400" /></button>
        </div>

        <form action={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <input type="hidden" name="approversJson" value={JSON.stringify(approvers)} />
          <input type="hidden" name="planDetailsJson" value={JSON.stringify(planRows)} />
          <input type="hidden" name="totalHours" value={totalHours} />
          <input type="hidden" name="recognizedHours" value={recognizedHours} />
          <input type="hidden" name="recognizedDays" value={recognizedDays} />
          <input type="hidden" name="isHoliday" value={isHoliday ? "true" : "false"} />
          <input type="hidden" name="requestType" value={requestType} />
          <input type="hidden" name="originalOvertimeId" value={selectedOriginalOtId} />
          {requestType === 'cancel' && (
            <><input type="hidden" name="title" value={title} /><input type="hidden" name="workDate" value={workDate} /><input type="hidden" name="startTime" value={startTime} /><input type="hidden" name="endTime" value={endTime} /><input type="hidden" name="location" value={location} /></>
          )}

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
            
            {/* 결재선 섹션 */}
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
                      <div className="text-xs text-gray-600 mb-1 flex justify-center items-center gap-1">결재 ({idx + 1}차) {isViewMode && (app.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-blue-600" /> : app.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-600" /> : <span className="text-[10px] text-gray-400">대기</span>)}</div>
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

            <div className="h-px bg-gray-100"></div>

            {/* 상세 입력 섹션 */}
            <section className="space-y-6 pointer-events-auto">
              <div>
                <label className={labelBase}>신청 유형</label>
                <div className="flex gap-4">
                  {REQUEST_TYPES.map(type => (
                    <label key={type.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all flex-1 justify-center ${requestType === type.id ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500 text-blue-700" : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"} ${isViewMode ? "cursor-default opacity-80" : ""}`}>
                      <input type="radio" name="requestTypeRadio" value={type.id} checked={requestType === type.id} disabled={isViewMode} onChange={(e) => setRequestType(e.target.value)} className="hidden" />
                      <type.icon className={`w-4 h-4 ${requestType === type.id ? "text-blue-600" : "text-gray-400"}`} />
                      <span className="text-sm font-bold">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(requestType === 'update' || requestType === 'cancel') && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className={labelBase}>{requestType === 'update' ? "수정 대상 초과근무" : "취소 대상 초과근무"} {isViewMode && <span className="text-xs font-normal text-gray-500 ml-2">(원본 데이터)</span>}</label>
                  {isViewMode ? (
                    originalOtForView ? (
                      <div className="p-4 rounded-lg border bg-gray-50 flex items-center justify-between">
                        <div>
                          <div className="flex gap-2 mb-1"><span className="text-xs font-bold bg-white border px-1.5 py-0.5 rounded">{originalOtForView.title}</span><span className="text-xs text-gray-500">{new Date(originalOtForView.created_at).toLocaleDateString()} 신청분</span></div>
                          <div className="text-sm font-bold flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5 text-gray-500" /> {originalOtForView.work_date} <span className="text-gray-300">|</span> {originalOtForView.start_time?.slice(0,5)} ~ {originalOtForView.end_time?.slice(0,5)} <span className="text-xs font-normal text-gray-600">({originalOtForView.recognized_hours}h 인정)</span></div>
                        </div>
                        <div className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border">원본</div>
                      </div>
                    ) : <div className="text-sm text-gray-500 p-3 border rounded bg-gray-50">원본 초과근무 정보를 불러올 수 없습니다.</div>
                  ) : (
                    <><div className="border rounded-lg bg-gray-50 p-4 max-h-60 overflow-y-auto space-y-2">
                        {approvedOvertimes.length === 0 ? <div className="text-center text-sm text-gray-500 py-4">선택 가능한(미사용) 승인된 초과근무 내역이 없습니다.</div> : approvedOvertimes.map(ot => (
                          <div key={ot.id} onClick={() => handleSelectOriginalOt(ot)} className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between group ${selectedOriginalOtId === ot.id ? "bg-blue-100 border-blue-500 ring-1 ring-blue-500" : "bg-white hover:border-blue-300 hover:shadow-sm"}`}>
                            <div>
                              <div className="flex gap-2 mb-1"><span className="text-xs font-bold bg-gray-100 px-1.5 py-0.5 rounded">{ot.title}</span><span className="text-xs text-gray-500">{new Date(ot.created_at).toLocaleDateString()} 신청</span></div>
                              <div className="text-sm font-bold flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5 text-gray-500" /> {ot.work_date} <span className="text-gray-300">|</span> {ot.start_time?.slice(0,5)} ~ {ot.end_time?.slice(0,5)} <span className="text-xs font-normal text-gray-600">({ot.recognized_hours}h 인정)</span></div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100" />
                          </div>
                        ))}
                      </div>
                      {selectedOriginalOtId && <p className="text-xs text-blue-600 mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {requestType === 'update' ? "선택한 정보가 적용되었습니다. 내용을 수정 후 결재를 상신하세요." : "선택한 내역을 취소합니다. 아래에 취소 사유를 입력해주세요."}</p>}
                    </>
                  )}
                </div>
              )}

              <div className={isFormDisabled ? "pointer-events-none grayscale" : ""}>
                <div>
                  <label className={labelBase}>제목</label>
                  <input type="text" name="title" disabled={isFormDisabled} value={title} onChange={(e) => setTitle(e.target.value)} className={inputBase} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label className={labelBase}>근무 일자</label>
                    <div className="flex items-center gap-2">
                      <input type="date" name="workDate" disabled={isFormDisabled} value={workDate} onChange={(e) => setWorkDate(e.target.value)} className={inputBase} />
                      {!isViewMode && !isFormDisabled ? (
                        <label className="flex items-center gap-1 whitespace-nowrap cursor-pointer select-none">
                          <input type="checkbox" name="isHolidayCheckbox" checked={isHoliday} onChange={(e) => setIsHoliday(e.target.checked)} className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" />
                          <span className="text-xs text-gray-700 font-medium">공휴일(2.0배)</span>
                        </label>
                      ) : isHoliday && <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold whitespace-nowrap"><AlertCircle className="w-3 h-3" /> 휴일근무 (2.0배)</span>}
                    </div>
                  </div>
                  <div>
                    <label className={labelBase}>근무 시간</label>
                    <div className="flex items-center gap-2">
                      {renderTimeSelect("startTime", startTime, setStartTime)}
                      <span className="text-gray-400">~</span>
                      {renderTimeSelect("endTime", endTime, setEndTime)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-xs font-bold text-gray-500 mb-1">총 근무 시간</label>
                    <div className="flex items-end gap-1"><span className="text-2xl font-bold text-gray-900">{totalHours}</span><span className="text-sm text-gray-600 mb-1">시간</span></div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Calculator className="w-12 h-12 text-blue-600" /></div>
                    <label className="block text-xs font-bold text-blue-600 mb-1 flex items-center gap-1">인정 휴가 (보상) {isHoliday || new Date(workDate).getDay() === 0 ? <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">2.0배</span> : <span className="text-[10px] bg-gray-200 text-gray-600 px-1 rounded">1.5배</span>}</label>
                    <div className="flex items-end gap-2"><span className="text-2xl font-bold text-blue-700">{recognizedHours}</span><span className="text-sm text-blue-600 mb-1">시간</span><span className="text-sm text-gray-400 mb-1">/</span><span className="text-xl font-bold text-gray-700 mb-0.5">{recognizedDays}</span><span className="text-sm text-gray-500 mb-1">일</span></div>
                    <p className="text-[10px] text-blue-400 mt-1">* 2시간 단위 인정 / 1일=8시간</p>
                  </div>
                </div>

                <div className="mt-6">
                  <label className={labelBase}>근무 장소</label>
                  <input type="text" name="location" disabled={isFormDisabled} value={location} onChange={(e) => setLocation(e.target.value)} className={inputBase} />
                </div>
              </div>

              <div>
                <label className={labelBase}>{requestType === 'cancel' ? "취소 사유" : "근무 사유"}</label>
                <input type="text" name="reason" disabled={isViewMode} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={requestType === 'cancel' ? "취소 사유를 입력해주세요." : "근무 사유를 입력해주세요."} className={inputBase} />
              </div>

              <div className={isFormDisabled ? "pointer-events-none grayscale" : ""}>
                <div className="flex justify-between items-end mb-2">
                  <label className={labelBase}>근무 계획</label>
                  {!isViewMode && !isFormDisabled && <button type="button" onClick={() => setPlanRows([...planRows, { id: Date.now(), startTime: "", endTime: "", content: "" }])} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">행 추가</button>}
                </div>
                
                <div className="border border-gray-300 rounded-lg bg-white">
                  <div className="hidden md:flex bg-gray-100 text-gray-700 font-bold border-b border-gray-300 text-sm">
                    <div className="px-4 py-3 w-[45%]">시간</div><div className="px-4 py-3 flex-1">계획 내용</div>{!isViewMode && !isFormDisabled && <div className="px-2 py-3 w-10"></div>}
                  </div>
                  <div className="divide-y divide-gray-200">
                    {planRows.map(row => (
                      <div key={row.id} className="flex flex-col md:flex-row md:items-center p-3 md:px-0 gap-3 md:gap-0">
                        <div className="px-0 md:px-4 md:w-[45%] shrink-0 flex items-center gap-2">
                          {renderTimeSelect(`plan-start-${row.id}`, row.startTime, (v) => updatePlanRow(row.id, 'startTime', v), "px-2 py-2 rounded")}
                          <span className="text-gray-400 shrink-0">~</span>
                          {renderTimeSelect(`plan-end-${row.id}`, row.endTime, (v) => updatePlanRow(row.id, 'endTime', v), "px-2 py-2 rounded")}
                        </div>
                        <div className="px-0 md:px-4 flex-1 min-w-0">
                          <input type="text" placeholder="내용 입력" disabled={isFormDisabled} value={row.content} onChange={(e) => updatePlanRow(row.id, 'content', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-600 placeholder:text-gray-400" />
                        </div>
                        {!isViewMode && !isFormDisabled && (
                          <div className="px-0 md:px-2 md:w-10 flex justify-end md:justify-center">
                            <button type="button" onClick={() => planRows.length > 1 && setPlanRows(planRows.filter(r => r.id !== row.id))} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-5 h-5 md:w-4 md:h-4" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">{isViewMode ? "닫기" : "취소"}</button>
            {!isViewMode && <button type="submit" disabled={isSubmitDisabled} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"><FileInput className="w-4 h-4 inline-block mr-1" />{isSubmitting ? "처리 중..." : "결재 상신"}</button>}
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

        {/* 결재선 관리 모달 */}
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
                          <div className="flex-1"><div className="font-bold text-sm text-gray-900">{line.title}</div><div className="text-xs text-gray-600 mt-0.5 flex gap-1">{line.approvers.map((a: any) => a.name).join(" → ")}</div></div>
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
