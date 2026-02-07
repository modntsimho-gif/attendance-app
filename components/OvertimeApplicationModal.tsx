"use client";

import { useState, useEffect } from "react";
import { X, Clock, Users, Plus, Trash2, CheckCircle2, XCircle, Bookmark, Save, ArrowDownToLine, Calculator, AlertCircle } from "lucide-react";
import { submitOvertimeRequest } from "@/app/actions/overtime";
import { getApprovers } from "@/app/actions/user";
import { getSavedLines, saveLine, deleteLine } from "@/app/actions/approval-line";
import { createClient } from "@/utils/supabase/client";

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

export default function OvertimeApplicationModal({ isOpen, onClose, onSuccess, initialData }: OvertimeApplicationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();
  const isViewMode = !!initialData;

  const [colleagues, setColleagues] = useState<ApproverUser[]>([]);
  const [approvers, setApprovers] = useState<ApproverUser[]>([]);
  
  // UI 상태
  const [isApproverSelectOpen, setIsApproverSelectOpen] = useState(false);
  const [isLineManagerOpen, setIsLineManagerOpen] = useState(false);

  // 결재선 저장 관련 상태
  const [savedLines, setSavedLines] = useState<any[]>([]);
  const [newLineTitle, setNewLineTitle] = useState("");

  // 근무 계획 테이블
  const [planRows, setPlanRows] = useState([{ id: 1, startTime: "", endTime: "", content: "" }]);
  
  // [계산 관련 상태]
  const [workDate, setWorkDate] = useState(""); 
  const [isHoliday, setIsHoliday] = useState(false); // 공휴일 상태
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  
  const [totalHours, setTotalHours] = useState("0.0"); 
  const [recognizedHours, setRecognizedHours] = useState(0); 
  const [recognizedDays, setRecognizedDays] = useState("0.00"); 

  useEffect(() => {
    if (isOpen) {
      if (isViewMode && initialData?.id) {
        // [VIEW MODE] 데이터 바인딩
        setWorkDate(initialData.work_date || "");
        setStartTime(initialData.start_time || "");
        setEndTime(initialData.end_time || "");
        setTotalHours(initialData.total_hours || "0.0");
        
        // [NEW] 공휴일 여부 바인딩 (DB 컬럼명: is_holiday 가정)
        setIsHoliday(!!initialData.is_holiday);

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
        // [CREATE MODE] 초기화
        const fetchColleagues = async () => {
          const data = await getApprovers();
          setColleagues(data);
        };
        fetchColleagues();
        setApprovers([]);
        setPlanRows([{ id: 1, startTime: "", endTime: "", content: "" }]);
        setWorkDate(new Date().toISOString().split('T')[0]); 
        setIsHoliday(false);
        setStartTime("");
        setEndTime("");
        setTotalHours("0.0");
        setRecognizedHours(0);
        setRecognizedDays("0.00");
      }
    } else {
      setIsApproverSelectOpen(false);
      setIsLineManagerOpen(false);
    }
  }, [isOpen, isViewMode, initialData]);

  // [NEW] 결재선 관리 모달 열릴 때 목록 불러오기
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

  // ---------------------------------------------------------
  // [CORE] 시간 및 보상 휴가 계산 로직
  // ---------------------------------------------------------
  useEffect(() => {
    // View 모드일 때는 계산 로직을 돌리지 않고 DB값(initialData)을 믿거나, 
    // UI 표시를 위해 재계산하되 isHoliday 상태가 반영되도록 함.
    if (startTime && endTime && workDate) {
      // 1. 실제 근무 시간 계산
      const start = new Date(`2000-01-01 ${startTime}`);
      const end = new Date(`2000-01-01 ${endTime}`);
      let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;
      
      setTotalHours(diff.toFixed(1));

      // 2. 요일 및 공휴일 확인
      const dateObj = new Date(workDate);
      const dayOfWeek = dateObj.getDay(); // 0:일, 6:토
      
      // 3. 가중치 및 한도 설정
      let multiplier = 1.5;
      let maxCap = 999; 

      if (dayOfWeek === 0 || isHoliday) { 
        // 일요일 or 공휴일 체크시
        multiplier = 2.0;
        maxCap = 16; 
      } else if (dayOfWeek === 6) {
        // 토요일
        multiplier = 1.5;
        maxCap = 12;
      }

      // 4. 가중 시간 계산
      const weightedHours = diff * multiplier;

      // 5. 2시간 단위 절삭 (내림) -> 2, 4, 6, 8...
      let finalHours = Math.floor(weightedHours / 2) * 2;

      // 6. 최대 한도 적용
      if (finalHours > maxCap) finalHours = maxCap;

      // 7. 일수 변환 (8시간 = 1일)
      const finalDays = finalHours / 8;

      setRecognizedHours(finalHours);
      setRecognizedDays(finalDays.toFixed(2));
    } else {
      setTotalHours("0.0");
      setRecognizedHours(0);
      setRecognizedDays("0.00");
    }
  }, [startTime, endTime, workDate, isHoliday]); // isHoliday 변경 시 재계산


  const addApprover = (userId: string) => {
    if (isViewMode) return;
    const user = colleagues.find((u) => u.id === userId);
    if (user && !approvers.find((a) => a.id === user.id)) {
      if (approvers.length >= 2) { alert("최대 2명까지 가능"); return; }
      setApprovers([...approvers, user]);
      setIsApproverSelectOpen(false);
    }
  };

  const removeApprover = (index: number) => {
    if (isViewMode) return;
    const newApprovers = [...approvers];
    newApprovers.splice(index, 1);
    setApprovers(newApprovers);
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
    if (approvers.length === 0) { alert("최소 1명 이상의 결재자를 지정해야 합니다."); return; }
    
    setIsSubmitting(true);
    const result = await submitOvertimeRequest(formData);
    if (result?.error) alert(result.error);
    else {
      alert("신청 완료!");
      if (onSuccess) onSuccess();
      onClose();
    }
    setIsSubmitting(false);
  }

  const renderStatusIcon = (status?: string) => {
    if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-600" />;
    return <span className="text-[10px] text-gray-400">대기</span>;
  };

  if (!isOpen) return null;

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
          {/* [NEW] 공휴일 여부 전송 */}
          <input type="hidden" name="isHoliday" value={isHoliday ? "true" : "false"} />

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
              
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                <div className="min-w-[100px] p-3 border border-blue-200 bg-blue-50 rounded-lg text-center flex-shrink-0">
                  <div className="text-xs text-blue-600 font-bold mb-1">기안</div>
                  <div className="text-sm font-bold text-gray-800">나 (본인)</div>
                  <div className="text-xs text-gray-500">신청완료</div>
                </div>
                <div className="text-gray-300">→</div>
                {approvers.map((app, idx) => (
                  <div key={app.id} className="flex items-center gap-3">
                    <div className={`min-w-[100px] p-3 border rounded-lg text-center relative group flex-shrink-0 ${
                      app.status === 'approved' ? 'bg-blue-50 border-blue-300' : 
                      app.status === 'rejected' ? 'bg-red-50 border-red-300' : 'bg-white border-blue-200'
                    }`}>
                      <div className="text-xs text-gray-500 mb-1 flex justify-center items-center gap-1">
                        결재 ({idx + 1}차) {isViewMode && renderStatusIcon(app.status)}
                      </div>
                      <div className="text-sm font-bold text-gray-800">{app.name}</div>
                      <div className="text-xs text-gray-500">{app.rank}</div>
                      {!isViewMode && (
                        <button type="button" onClick={() => removeApprover(idx)} className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      onClick={() => setIsApproverSelectOpen(true)}
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
            <section className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
                <input type="text" name="title" disabled={isViewMode} defaultValue={initialData?.title || `초과근무신청서_(${new Date().toLocaleDateString()})`} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">근무 일자</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      name="workDate" 
                      disabled={isViewMode} 
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" 
                    />
                    
                    {/* [NEW] 공휴일 체크박스 및 배지 */}
                    {!isViewMode ? (
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
                    <input type="time" name="startTime" disabled={isViewMode} value={startTime} onChange={(e) => setStartTime(e.target.value)} className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
                    <span className="text-gray-400">~</span>
                    <input type="time" name="endTime" disabled={isViewMode} value={endTime} onChange={(e) => setEndTime(e.target.value)} className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
                  </div>
                </div>
              </div>

              {/* 근무 시간 및 인정 휴가 표시 영역 */}
              <div className="grid grid-cols-2 gap-4">
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

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">근무 장소</label>
                <input type="text" name="location" disabled={isViewMode} defaultValue={initialData?.location} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">근무 사유</label>
                <input type="text" name="reason" disabled={isViewMode} defaultValue={initialData?.reason} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
              </div>

              {/* 근무 계획 테이블 */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-bold text-gray-700">근무 계획</label>
                  {!isViewMode && <button type="button" onClick={addPlanRow} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">행 추가</button>}
                </div>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-300">
                      <tr>
                        <th className="px-4 py-3 w-[35%]">시간</th>
                        <th className="px-4 py-3">계획 내용</th>
                        {!isViewMode && <th className="px-2 py-3 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {planRows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <input type="time" disabled={isViewMode} value={row.startTime} onChange={(e) => updatePlanRow(row.id, 'startTime', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs disabled:bg-gray-100" />
                              <span className="text-gray-400">~</span>
                              <input type="time" disabled={isViewMode} value={row.endTime} onChange={(e) => updatePlanRow(row.id, 'endTime', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs disabled:bg-gray-100" />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input type="text" disabled={isViewMode} value={row.content} onChange={(e) => updatePlanRow(row.id, 'content', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100" />
                          </td>
                          {!isViewMode && (
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

          {/* 푸터 */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">
              {isViewMode ? "닫기" : "취소"}
            </button>
            {!isViewMode && (
              <button 
                type="submit" 
                disabled={isSubmitting || approvers.length === 0} 
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting ? "처리 중..." : "결재 상신"}
              </button>
            )}
          </div>
        </form>

        {/* 결재자 선택 및 결재선 관리 모달은 그대로 유지 */}
        {isApproverSelectOpen && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-64 max-h-[300px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
                <span className="font-bold text-sm text-gray-700">결재자 선택</span>
                <button type="button" onClick={() => setIsApproverSelectOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <ul className="flex-1 overflow-y-auto p-1">
                {colleagues.map((user) => (
                  <li key={user.id}>
                    <button type="button" onClick={() => addApprover(user.id)} className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 rounded-lg flex justify-between items-center group transition-colors border-b border-gray-50 last:border-0">
                      <span className="font-medium text-gray-800">{user.name}</span>
                      <span className="text-gray-400 text-xs bg-gray-100 px-2 py-0.5 rounded-full group-hover:bg-white">{user.rank}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

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
