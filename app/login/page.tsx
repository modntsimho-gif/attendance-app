"use client";

import { useState } from "react";
import Image from "next/image"; 
import { login, signup, resetPassword } from "./actions"; 
import { Loader2, User, Lock, Mail, Building, IdCard, ChevronDown, Calendar, ShieldCheck, ArrowLeft } from "lucide-react"; 

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    try {
      if (view === "login") {
        const error = await login(formData);
        if (error) setMessage(error);
      } else if (view === "signup") {
        const error = await signup(formData);
        // 에러가 없으면 서버 액션에서 redirect("/") 하므로 여기 코드는 실행되지 않음
        if (error) setMessage(error);
      } else if (view === "reset") {
        const result = await resetPassword(formData);
        if (result === "success") {
            setSuccessMessage("재설정 링크가 이메일로 전송되었습니다.");
        } else {
            setMessage(result);
        }
      }
    } catch (e) {
      // redirect()가 발생하면 에러처럼 잡히는 경우가 있어서 예외 처리
      const errStr = String(e);
      if (errStr.includes("NEXT_REDIRECT")) return; 
      setMessage("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
        
        {/* 헤더 */}
        <div className="bg-white p-8 pb-6 text-center border-b border-gray-100">
          <div className="flex justify-center mb-4">
            {/* 로고 이미지가 없다면 텍스트로 대체되거나 빈 박스가 보일 수 있음 */}
            <div className="relative w-48 h-16 flex items-center justify-center">
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
