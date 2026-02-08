"use client";

import { useState, useEffect, useRef } from "react";
import { X, Clock, Users, Plus, Trash2, CheckCircle2, XCircle, Bookmark, Save, ArrowDownToLine, Calculator, AlertCircle, RefreshCw, FileInput, FilePenLine, FileX2, Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { submitOvertimeRequest } from "@/app/actions/overtime";
import { getApprovers } from "@/app/actions/user";
import { getSavedLines, saveLine, deleteLine } from "@/app/actions/approval-line";
import { createClient } from "@/utils/supabase/client";

const REQUEST_TYPES = [
  { id: "create", label: "신청", icon: FileInput },
  { id: "update", label: "변경", icon: FilePenLine },
  { id: "cancel", label: "취소", icon: FileX2 },
];

interface OvertimeApplicationModalProps {
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
  recognized_hours: number;
  location?: string;
  reason: string;
  plan_details?: any;
  is_holiday: boolean;
  created_at: string;
}

export default function OvertimeApplicationModal({ isOpen, onClose, onSuccess, initialData }: OvertimeApplicationModalProps) {
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
  const [approvedOvertimes, setApprovedOvertimes] = useState<OvertimeRecord[]>([]);
  const [selectedOriginalOtId, setSelectedOriginalOtId] = useState<string>("");

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

  useEffect(() => {
    if (isOpen) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      if (isViewMode && initialData?.id) {
        setTitle(initialData.title || "");
        setWorkDate(initialData.work_date || "");
        setStartTime(initialData.start_time || "");
        setEndTime(initialData.end_time || "");
        setTotalHours(initialData.total_hours || "0.0");
        setIsHoliday(!!initialData.is_holiday);
        setLocation(initialData.location || "");
        setReason(initialData.reason || "");
        
        setRequestType(initialData.request_type || "create");
        setSelectedOriginalOtId(initialData.original_overtime_request_id || "");

        if (initialData.plan_details) {
          try {
            const parsed = typeof initialData.plan_details === 'string' ? JSON.parse(initialData.plan_details) : initialData.plan_details;
            setPlanRows(parsed);
          } catch (e) { console.error(e); }
        }

        const fetchSavedApprovers = async () => {
          const { data: lines } = await supabase.from("approval_lines").select("*").eq("overtime_request_id", initialData.id).order("step_order", { ascending: true });
          if (!lines) return;
          const { data: profiles } = await supabase.from("profiles").select("id, name, position, department").in("id", lines.map(l => l.approver_id));
          if (profiles) {
            setApprovers(lines.map(l => {
              const p = profiles.find(pf => pf.id === l.approver_id);
              return { id: l.approver_id, name: p?.name || "-", rank: p?.position || "-", dept: p?.department || "-", status: l.status };
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
        setPlanRows([{ id: 1, startTime: "", endTime: "", content: "" }]);
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        setWorkDate(todayStr); 
        setIsHoliday(today.getDay() === 0); 
        setTitle(`초과근무신청서_${todayStr}`);

        setStartTime("");
        setEndTime("");
        setLocation("");
        setReason("");
        setTotalHours("0.0");
        setRecognizedHours(0);
        setRecognizedDays("0.00");
        setEditingApproverIndex(null);

        setRequestType("create");
        setSelectedOriginalOtId("");
        setApprovedOvertimes([]);
      }
    } else {
      setIsApproverSelectOpen(false);
      setIsLineManagerOpen(false);
      setEditingApproverIndex(null);
    }
  }, [isOpen, isViewMode, initialData]);

  useEffect(() => {
    if (isViewMode || !isOpen) return;

    if (requestType === 'update' || requestType === 'cancel') {
      const fetchApprovedOvertimes = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("overtime_requests")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "approved")
          .or("used_hours.is.null,used_hours.eq.0")
          .order("work_date", { ascending: false });
        
        if (data) {
          setApprovedOvertimes(data);
        }
      };
      fetchApprovedOvertimes();
      
      setSelectedOriginalOtId("");
      
    } else if (requestType === 'create') {
      setReason("");
      setSelectedOriginalOtId("");
      setApprovedOvertimes([]);
    }
  }, [requestType, isOpen, isViewMode]);

  const handleSelectOriginalOt = (ot: OvertimeRecord) => {
    setSelectedOriginalOtId(ot.id);
    
    setTitle(ot.title);
    setWorkDate(ot.work_date);
    setStartTime(ot.start_time);
    setEndTime(ot.end_time);
    setLocation(ot.location || "");
    setIsHoliday(ot.is_holiday);
    
    if (ot.plan_details) {
        try {
          const parsed = typeof ot.plan_details === 'string' ? JSON.parse(ot.plan_details) : ot.plan_details;
          setPlanRows(parsed);
        } catch (e) { 
            setPlanRows([{ id: 1, startTime: "", endTime: "", content: "" }]);
        }
    }

    if (requestType === 'cancel') {
        setReason("");
    } else {
        setReason(ot.reason || "");
    }
  };

  useEffect(() => {
    if (!isViewMode && workDate && requestType === 'create') {
      const date = new Date(workDate);
      setIsHoliday(date.getDay() === 0);
      if (title.startsWith("초과근무신청서_")) {
          setTitle(`초과근무신청서_${workDate}`);
      }
    }
  }, [workDate, isViewMode, requestType]);

  useEffect(() => {
    if (isLineManagerOpen) loadSavedLines();
  }, [isLineManagerOpen]);

  const loadSavedLines = async () => {
    const lines = await getSavedLines();
    setSavedLines(lines);
  };

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

  useEffect(() => {
    if (startTime && endTime && workDate) {
      const start = new Date(`2000-01-01 ${startTime}`);
      const end = new Date(`2000-01-01 ${endTime}`);
      let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;
      setTotalHours(diff.toFixed(1));

      const dateObj = new Date(workDate);
      const dayOfWeek = dateObj.getDay(); 
      let multiplier = 1.5;
      let maxCap = 999; 

      if (dayOfWeek === 0 || isHoliday) { 
        multiplier = 2.0;
        maxCap = 16; 
      } else if (dayOfWeek === 6) {
        multiplier = 1.5;
        maxCap = 12;
      }

      const weightedHours = diff * multiplier;
      let finalHours = Math.floor(weightedHours / 2) * 2; 
      if (finalHours > maxCap) finalHours = maxCap;
      const finalDays = finalHours / 8;

      setRecognizedHours(finalHours);
      setRecognizedDays(finalDays.toFixed(2));
    } else {
      setTotalHours("0.0");
      setRecognizedHours(0);
      setRecognizedDays("0.00");
    }
  }, [startTime, endTime, workDate, isHoliday]);

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
      if (approvers.length >= 2) { alert("최대 2명까지 가능"); return; }
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

  const addPlanRow = () => {
    if (isViewMode) return;
    const newId = planRows.length > 0 ? Math.max(...planRows.map(r => r.id)) + 1 : 1;
    setPlanRows([...planRows, { id: newId, startTime: "", endTime: "", content: "" }]);
  };

  const removePlanRow = (id: number) => {
    if (isViewMode) return;
    if (planRows.length === 1) return;
    setPlanRows(planRows.filter(row => row.id !== id));
  };

  const updatePlanRow = (id: number, field: string, value: string) => {
    if (isViewMode) return;
    setPlanRows(planRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  async function handleSubmit(formData: FormData) {
    if (isViewMode) return;
    if (isSubmittingRef.current) return;

    if (approvers.length === 0) { alert("최소 1명 이상의 결재자를 지정해야 합니다."); return; }
    
    if ((requestType === 'update' || requestType === 'cancel') && !selectedOriginalOtId) {
        alert(`${requestType === 'update' ? '변경' : '취소'}할 기존 초과근무 내역을 선택해주세요.`);
        return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await submitOvertimeRequest(formData);
      
      if (result?.error) {
         alert(result.error);
         isSubmittingRef.current = false;
         setIsSubmitting(false);
      } else {
        alert("신청 완료!");
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
    return <span className="text-[10px] text-gray-400">대기</span>;
  };

  if (!isOpen) return null;

  const isFormDisabled = isViewMode || requestType === 'cancel';
  
  // ⭐️ [NEW] 버튼 비활성화 조건 계산
  const isOriginalRequired = requestType === 'update' || requestType === 'cancel';
  const isOriginalMissing = isOriginalRequired && !selectedOriginalOtId;
  const isSubmitDisabled = isSubmitting || approvers.length === 0 || isOriginalMissing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600" />
              {isViewMode ? "초과근무 신청서 상세" : "초과근무 신청서 작성"}
            </h2>
            <div className="flex gap-3 mt-1 text-xs text-gray-500">
              <span>문서번호: <span className="text-gray-400">{isViewMode ? `OT-${initialData.id.slice(0,8)}` : "자동생성"}</span></span>
            </div>
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
            <>
                <input type="hidden" name="title" value={title} />
                <input type="hidden" name="workDate" value={workDate} />
                <input type="hidden" name="startTime" value={startTime} />
                <input type="hidden" name="endTime" value={endTime} />
                <input type="hidden" name="location" value={location} />
            </>
          )}

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
            
            {/* 결재선 섹션 */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
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
                  <div className="text-sm font-bold text-gray-800">나 (본인)</div>
                  <div className="text-xs text-gray-500">신청완료</div>
                </div>
                <div className="text-gray-300">→</div>
                
                {approvers.map((app, idx) => (
                  <div key={app.id} className="flex items-center gap-3">
                    <div 
                      onClick={() => handleApproverClick(idx)}
                      className={`min-w-[100px] p-3 border rounded-lg text-center relative group flex-shrink-0 transition-all ${
                        app.status === 'approved' ? 'bg-blue-50 border-blue-300' : 
                        app.status === 'rejected' ? 'bg-red-50 border-red-300' : 
                        !isViewMode ? 'bg-white border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer' : 'bg-white border-blue-200'
                    }`}>
                      <div className="text-xs text-gray-500 mb-1 flex justify-center items-center gap-1">
                        결재 ({idx + 1}차) {isViewMode && renderStatusIcon(app.status)}
                      </div>
                      <div className="text-sm font-bold text-gray-800">{app.name}</div>
                      <div className="text-xs text-gray-500">{app.rank}</div>
                      
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
                    {idx < approvers.length - 1 && <div className="text-gray-300">→</div>}
                  </div>
                ))}

                {!isViewMode && approvers.length < 2 && (
                  <>
                    {approvers.length > 0 && <div className="text-gray-300">→</div>}
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

            <div className="h-px bg-gray-100"></div>

            {/* 상세 입력 */}
            <section className="space-y-6 pointer-events-auto">
              
              {/* 신청 유형 선택 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">신청 유형</label>
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
                            : "bg-white border-gray-200 hover:bg-gray-50 text-gray-600"
                        } ${isViewMode ? "cursor-default opacity-80" : ""}`}
                      >
                        <input 
                          type="radio" 
                          name="requestTypeRadio" 
                          value={type.id}
                          checked={isSelected}
                          disabled={isViewMode}
                          onChange={(e) => setRequestType(e.target.value)}
                          className="hidden" 
                        />
                        <Icon className={`w-4 h-4 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                        <span className="text-sm font-bold">{type.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 변경/취소 대상 선택 섹션 */}
              {!isViewMode && (requestType === 'update' || requestType === 'cancel') && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {requestType === 'update' ? "수정할 초과근무 선택" : "취소할 초과근무 선택"} (미사용 건만 표시)
                  </label>
                  <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 max-h-60 overflow-y-auto space-y-2">
                    {approvedOvertimes.length === 0 ? (
                      <div className="text-center text-sm text-gray-400 py-4">
                        선택 가능한(미사용) 승인된 초과근무 내역이 없습니다.
                      </div>
                    ) : (
                      approvedOvertimes.map((ot) => (
                        <div 
                          key={ot.id}
                          onClick={() => handleSelectOriginalOt(ot)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${
                            selectedOriginalOtId === ot.id 
                              ? "bg-blue-100 border-blue-500 ring-1 ring-blue-500" 
                              : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{ot.title}</span>
                              <span className="text-xs text-gray-400">{new Date(ot.created_at).toLocaleDateString()} 신청</span>
                            </div>
                            <div className="text-sm font-bold text-gray-800 flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-gray-500" />
                              {ot.work_date}
                              <span className="text-gray-300">|</span>
                              {ot.start_time?.slice(0,5)} ~ {ot.end_time?.slice(0,5)}
                              <span className="text-xs font-normal text-gray-500 ml-1">({ot.recognized_hours}h 인정)</span>
                            </div>
                          </div>
                          <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedOriginalOtId && (
                    <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {requestType === 'update' 
                        ? "선택한 정보가 적용되었습니다. 내용을 수정 후 결재를 상신하세요."
                        : "선택한 내역을 취소합니다. 아래에 취소 사유를 입력해주세요."
                      }
                    </p>
                  )}
                </div>
              )}

              <div className={isFormDisabled ? "opacity-60 pointer-events-none grayscale" : ""}>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
                  <input 
                    type="text" 
                    name="title" 
                    disabled={isFormDisabled} 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">근무 일자</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="date" 
                        name="workDate" 
                        disabled={isFormDisabled} 
                        value={workDate}
                        onChange={(e) => setWorkDate(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" 
                      />
                      {!isViewMode && !isFormDisabled ? (
                        <label className="flex items-center gap-1 whitespace-nowrap cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            name="isHolidayCheckbox"
                            checked={isHoliday} 
                            onChange={(e) => setIsHoliday(e.target.checked)}
                            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" 
                          />
                          <span className="text-xs text-gray-600 font-medium">공휴일(2.0배)</span>
                        </label>
                      ) : isHoliday && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold whitespace-nowrap">
                          <AlertCircle className="w-3 h-3" />
                          휴일근무 (2.0배)
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">근무 시간</label>
                    <div className="flex items-center gap-2">
                      <input type="time" name="startTime" disabled={isFormDisabled} value={startTime} onChange={(e) => setStartTime(e.target.value)} className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
                      <span className="text-gray-400">~</span>
                      <input type="time" name="endTime" disabled={isFormDisabled} value={endTime} onChange={(e) => setEndTime(e.target.value)} className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-xs font-bold text-gray-500 mb-1">총 근무 시간</label>
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-bold text-gray-800">{totalHours}</span>
                      <span className="text-sm text-gray-500 mb-1">시간</span>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <Calculator className="w-12 h-12 text-blue-600" />
                    </div>
                    <label className="block text-xs font-bold text-blue-600 mb-1 flex items-center gap-1">
                      인정 휴가 (보상)
                      {isHoliday || new Date(workDate).getDay() === 0 ? <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">2.0배</span> : <span className="text-[10px] bg-gray-200 text-gray-600 px-1 rounded">1.5배</span>}
                    </label>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold text-blue-700">{recognizedHours}</span>
                      <span className="text-sm text-blue-600 mb-1">시간</span>
                      <span className="text-sm text-gray-400 mb-1">/</span>
                      <span className="text-xl font-bold text-gray-700 mb-0.5">{recognizedDays}</span>
                      <span className="text-sm text-gray-500 mb-1">일</span>
                    </div>
                    <p className="text-[10px] text-blue-400 mt-1">* 2시간 단위 인정 / 1일=8시간</p>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">근무 장소</label>
                  <input type="text" name="location" disabled={isFormDisabled} value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {requestType === 'cancel' ? "취소 사유" : "근무 사유"}
                </label>
                <input 
                  type="text" 
                  name="reason" 
                  disabled={isViewMode} 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)} 
                  placeholder={requestType === 'cancel' ? "취소 사유를 입력해주세요." : "근무 사유를 입력해주세요."}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 placeholder:text-gray-400" 
                />
              </div>

              <div className={isFormDisabled ? "opacity-60 pointer-events-none grayscale" : ""}>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-bold text-gray-700">근무 계획</label>
                  {!isViewMode && !isFormDisabled && <button type="button" onClick={addPlanRow} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">행 추가</button>}
                </div>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-300">
                      <tr>
                        <th className="px-4 py-3 w-[35%]">시간</th>
                        <th className="px-4 py-3">계획 내용</th>
                        {!isViewMode && !isFormDisabled && <th className="px-2 py-3 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {planRows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <input type="time" disabled={isFormDisabled} value={row.startTime} onChange={(e) => updatePlanRow(row.id, 'startTime', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs disabled:bg-gray-100" />
                              <span className="text-gray-400">~</span>
                              <input type="time" disabled={isFormDisabled} value={row.endTime} onChange={(e) => updatePlanRow(row.id, 'endTime', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs disabled:bg-gray-100" />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input type="text" disabled={isFormDisabled} value={row.content} onChange={(e) => updatePlanRow(row.id, 'content', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100" />
                          </td>
                          {!isViewMode && !isFormDisabled && (
                            <td className="px-2 py-2 text-center">
                              <button type="button" onClick={() => removePlanRow(row.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">
              {isViewMode ? "닫기" : "취소"}
            </button>
            {!isViewMode && (
              <button 
                type="submit" 
                // ⭐️ [NEW] 버튼 비활성화 조건 적용
                disabled={isSubmitDisabled} 
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting ? "처리 중..." : "결재 상신"}
              </button>
            )}
          </div>
        </form>

        {/* 결재자 선택 모달 */}
        {isApproverSelectOpen && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-64 max-h-[300px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
                <span className="font-bold text-sm text-gray-700">
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
                      <span className="font-medium text-gray-800">{user.name}</span>
                      <span className="text-gray-400 text-xs bg-gray-100 px-2 py-0.5 rounded-full group-hover:bg-white">{user.rank}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 결재선 관리 모달 */}
        {isLineManagerOpen && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-5 py-4 border-b bg-gray-50 flex justify-between items-center">
                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-blue-600" /> 나만의 결재선
                </h4>
                <button type="button" onClick={() => setIsLineManagerOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 flex-1 overflow-y-auto space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">현재 설정 저장</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="예: 팀장님 전결..." value={newLineTitle} onChange={(e) => setNewLineTitle(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    <button type="button" onClick={handleSaveLine} disabled={approvers.length === 0} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"><Save className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="h-px bg-gray-100"></div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">불러오기</label>
                  {savedLines.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">저장된 결재선이 없습니다.</div>
                  ) : (
                    <ul className="space-y-2">
                      {savedLines.map((line) => (
                        <li key={line.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group">
                          <div className="flex-1">
                            <div className="font-bold text-sm text-gray-800">{line.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5 flex gap-1">{line.approvers.map((a: any) => a.name).join(" → ")}</div>
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
