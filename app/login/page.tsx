"use client";

import { useState } from "react";
import { login, signup } from "./actions";
import { Loader2, Briefcase, User, Lock, Mail, Building, IdCard, ChevronDown } from "lucide-react";

// 부서 및 직급 목록 정의
const DEPARTMENTS = ["CEO", "대외협력팀", "소원사업팀", "경영지원팀"];
const POSITIONS = ["간사", "대리", "과장", "팀장", "사무총장"];

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        // 로그인 시도
        const error = await login(formData);
        if (error) setMessage(error);
      } else {
        // 회원가입 시도
        const error = await signup(formData);
        if (error) setMessage(error);
        else setMessage("가입 성공! 이메일을 확인해주세요 (혹은 자동 로그인됩니다).");
      }
    } catch (e) {
      setMessage("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        
        {/* 헤더 */}
        <div className="bg-gray-900 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">근태 관리 시스템</h1>
          <p className="text-gray-400 text-sm mt-2">
            {isLogin ? "업무를 시작하려면 로그인하세요" : "새로운 계정을 생성합니다"}
          </p>
        </div>

        {/* 폼 영역 */}
        <div className="p-8">
          {/* 탭 전환 */}
          <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                isLogin ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                !isLogin ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              회원가입
            </button>
          </div>

          <form action={handleSubmit} className="space-y-4">
            {/* 이메일 (공통) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="user@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* 비밀번호 (공통) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* 회원가입 시 추가 정보 입력 */}
            {!isLogin && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="h-px bg-gray-100 my-2"></div>
                
                {/* 이름 입력 */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 ml-1">이름</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      name="name"
                      type="text"
                      required={!isLogin}
                      placeholder="홍길동"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  {/* 부서 선택 (Dropdown) */}
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-bold text-gray-500 ml-1">부서</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                      <select
                        name="department"
                        required={!isLogin}
                        defaultValue=""
                        className="w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer text-gray-700"
                      >
                        <option value="" disabled>선택</option>
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* 직급 선택 (Dropdown) */}
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-bold text-gray-500 ml-1">직급</label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                      <select
                        name="position"
                        required={!isLogin}
                        defaultValue=""
                        className="w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer text-gray-700"
                      >
                        <option value="" disabled>선택</option>
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 에러 메시지 */}
            {message && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center font-medium">
                {message}
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                "로그인하기"
              ) : (
                "가입하기"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
