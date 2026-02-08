"use client";

import { useState } from "react";
import Image from "next/image"; 
import { login, signup, resetPassword } from "./actions"; 
import { Loader2, User, Lock, Mail, Building, IdCard, ChevronDown, Calendar, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react"; // ⭐️ CheckCircle2 아이콘 추가

// ... (상수 DEPARTMENTS, POSITIONS, ROLES 등 기존 동일) ...
const DEPARTMENTS = ["CEO", "대외협력팀", "소원사업팀", "경영지원팀"];
const POSITIONS = ["간사", "대리", "과장", "차장" ,"팀장", "사무총장"];
const ROLES = [
  { value: "employee", label: "일반 직원" },
  { value: "manager", label: "관리자" },
];

type ViewMode = "login" | "signup" | "reset";

export default function LoginPage() {
  const [view, setView] = useState<ViewMode>("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  // ⭐️ 성공 상태를 더 명확하게 관리하기 위해 boolean이나 구체적 string 사용
  const [isEmailSent, setIsEmailSent] = useState(false); 
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setMessage(null);
    setSuccessMessage(null);
    setIsEmailSent(false);

    try {
      if (view === "login") {
        const error = await login(formData);
        if (error) {
          // 이메일 미인증 에러 처리 (Supabase 에러 메시지에 따라 다를 수 있음)
          if (error.includes("Email not confirmed")) {
            setMessage("이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.");
          } else {
            setMessage(error);
          }
        }
      } else if (view === "signup") {
        const error = await signup(formData);
        if (error) {
          setMessage(error);
        } else {
          // ⭐️ 회원가입 성공 시 로직
          setIsEmailSent(true); // 이메일 전송 완료 화면 보여주기
          setSuccessMessage("인증 메일이 발송되었습니다!");
        }
      } else if (view === "reset") {
        const result = await resetPassword(formData);
        if (result === "success") {
            setSuccessMessage("재설정 링크가 이메일로 전송되었습니다.");
        } else {
            setMessage(result);
        }
      }
    } catch (e) {
      const errStr = String(e);
      if (errStr.includes("NEXT_REDIRECT")) return;
      setMessage("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ⭐️ 이메일 인증 안내 화면 (회원가입 성공 직후)
  if (isEmailSent && view === "signup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">메일함을 확인해주세요!</h2>
          <p className="text-gray-600 mb-8">
            입력하신 이메일로 인증 링크를 보냈습니다.<br/>
            링크를 클릭하면 회원가입이 완료됩니다.
          </p>
          <button
            onClick={() => {
              setIsEmailSent(false);
              setView("login");
              setMessage(null);
              setSuccessMessage(null);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all"
          >
            로그인 화면으로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
        
        {/* 헤더 */}
        <div className="bg-white p-8 pb-6 text-center border-b border-gray-100">
          <div className="flex justify-center mb-4">
            <div className="relative w-48 h-16">
              <Image src="/logo.png" alt="Make-A-Wish Korea" fill className="object-contain" priority />
            </div>
          </div>
          <h1 className="text-xl font-bold text-blue-900">근태 관리 시스템</h1>
          <p className="text-gray-500 text-sm mt-2">
            {view === "login" && "Make-A-Wish Korea 임직원 전용"}
            {view === "signup" && "새로운 계정을 생성합니다"}
            {view === "reset" && "비밀번호를 초기화합니다"}
          </p>
        </div>

        {/* 폼 영역 */}
        <div className="p-8 pt-6">
          
          {/* 탭 버튼 */}
          {view !== "reset" && (
            <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => { setView("login"); setMessage(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  view === "login" ? "bg-white text-blue-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => { setView("signup"); setMessage(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  view === "signup" ? "bg-white text-blue-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                회원가입
              </button>
            </div>
          )}

          <form action={handleSubmit} className="space-y-4">
            {/* 이메일 */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="user@makeawish.or.kr"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            {view !== "reset" && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 ml-1">비밀번호</label>
                  {view === "login" && (
                    <button 
                      type="button"
                      onClick={() => { setView("reset"); setMessage(null); setSuccessMessage(null); }}
                      className="text-xs text-blue-600 font-bold hover:underline"
                    >
                      비밀번호를 잊으셨나요?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    name="password"
                    type="password"
                    required 
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>
            )}

            {/* 회원가입 추가 정보 */}
            {view === "signup" && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="h-px bg-gray-100 my-2"></div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 ml-1">이름</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input name="name" type="text" required placeholder="홍길동" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-gray-400" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-bold text-gray-500 ml-1">부서</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                      <select name="department" required defaultValue="" className="w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none cursor-pointer">
                        <option value="" disabled>선택</option>
                        {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-bold text-gray-500 ml-1">직급</label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                      <select name="position" required defaultValue="" className="w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none cursor-pointer">
                        <option value="" disabled>선택</option>
                        {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-bold text-gray-500 ml-1">입사일</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                      <input name="join_date" type="date" required className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-gray-400" />
                    </div>
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-bold text-gray-500 ml-1">권한 설정</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                      <select name="role" required defaultValue="employee" className="w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none cursor-pointer">
                        {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 메시지 표시 */}
            {message && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center font-medium">{message}</div>}
            {successMessage && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg text-center font-medium">{successMessage}</div>}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : view === "login" ? (
                "로그인하기"
              ) : view === "signup" ? (
                "가입하기"
              ) : (
                "재설정 링크 보내기"
              )}
            </button>

            {/* 리셋 모드일 때 뒤로가기 버튼 */}
            {view === "reset" && (
              <button
                type="button"
                onClick={() => { setView("login"); setMessage(null); setSuccessMessage(null); }}
                className="w-full text-gray-500 font-bold py-2 text-sm hover:text-gray-800 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> 로그인으로 돌아가기
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
