"use client";

import { User, Home, Plane, CalendarHeart, Megaphone, Clock, Briefcase } from "lucide-react";

export default function DashboardWidgets() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      
      {/* 위젯 1: 오늘 우리 팀 현황 */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          오늘 우리 팀 현황
        </h3>
        
        <div className="flex-1 space-y-3">
          {/* 휴가자 */}
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-bold text-xs">
                김
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">김토스</div>
                <div className="text-xs text-red-500 font-medium">연차 휴가 중</div>
              </div>
            </div>
            <span className="text-xs bg-white px-2 py-1 rounded text-red-600 font-bold shadow-sm">OFF</span>
          </div>

          {/* 재택근무 */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-xs">
                이
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">이디자</div>
                <div className="text-xs text-green-600 font-medium">재택 근무 (10:00~19:00)</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded text-green-700 font-bold shadow-sm">
              <Home className="w-3 h-3" /> WFH
            </div>
          </div>

          {/* 외근 */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
                박
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">박백엔</div>
                <div className="text-xs text-blue-600 font-medium">외근 (클라이언트 미팅)</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded text-blue-700 font-bold shadow-sm">
              <Plane className="w-3 h-3" /> Trip
            </div>
          </div>
        </div>
      </div>

      {/* 위젯 2: 주요 일정 & D-Day */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <CalendarHeart className="w-5 h-5 text-pink-500" />
          다가오는 주요 일정
        </h3>

        <div className="flex-1 space-y-0">
          {/* D-Day 카드 */}
          <div className="mb-4 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-4 text-white shadow-md relative overflow-hidden group">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
              <Plane className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <div className="text-xs font-medium text-purple-100 mb-1">내 다음 휴가까지</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">D-12</span>
                <span className="text-sm text-purple-200 mb-1">(2월 28일)</span>
              </div>
            </div>
          </div>

          {/* 리스트 */}
          <div className="divide-y divide-gray-100">
            {/* 1. 공휴일 */}
            <div className="py-3 flex items-center gap-3">
              <div className="w-10 text-center">
                <div className="text-[10px] text-gray-400 font-bold">MAR</div>
                <div className="text-lg font-bold text-red-500 leading-none">01</div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-700">삼일절 (공휴일) 🇰🇷</div>
                <div className="text-xs text-gray-400">법정 공휴일 휴무</div>
              </div>
              <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">D-13</div>
            </div>

            {/* 2. 프로젝트 마감 (급여일 대체) */}
            <div className="py-3 flex items-center gap-3">
              <div className="w-10 text-center">
                <div className="text-[10px] text-gray-400 font-bold">MAR</div>
                <div className="text-lg font-bold text-gray-800 leading-none">10</div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-700">Q1 프로젝트 마감</div>
                <div className="text-xs text-gray-400">최종 배포 및 회고</div>
              </div>
              <div className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">D-22</div>
            </div>

            {/* 3. 타운홀 미팅 */}
            <div className="py-3 flex items-center gap-3">
              <div className="w-10 text-center">
                <div className="text-[10px] text-gray-400 font-bold">MAR</div>
                <div className="text-lg font-bold text-gray-800 leading-none">15</div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-700">전사 타운홀 미팅</div>
                <div className="text-xs text-gray-400">대회의실 A (14:00)</div>
              </div>
              <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">D-27</div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
