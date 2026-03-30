"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Users } from "lucide-react";
import { getColleaguesColors, saveColleagueColor, saveBulkColleagueColors } from "@/app/actions/calendar-settings";

const PALETTE = [
  "#FCA5A5", "#FDBA74", "#FCD34D", "#86EFAC", "#67E8F9", 
  "#93C5FD", "#C4B5FD", "#F9A8D4", "#F87171", "#60A5FA"
];

type Profile = { id: string; name: string; department: string };

export default function CalendarSettingsPage() {
  const [groupedProfiles, setGroupedProfiles] = useState<Record<string, Profile[]>>({});
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingDept, setSavingDept] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { profiles, preferences } = await getColleaguesColors();
        
        // ⭐️ 1. 부서별로 데이터 그룹화
        const grouped = profiles.reduce((acc: Record<string, Profile[]>, profile: Profile) => {
          const dept = profile.department || "부서 미지정";
          if (!acc[dept]) acc[dept] = [];
          acc[dept].push(profile);
          return acc;
        }, {});
        setGroupedProfiles(grouped);
        
        // 2. 기존 설정된 색상 매핑
        const map: Record<string, string> = {};
        preferences.forEach((pref: any) => {
          map[pref.target_user_id] = pref.color;
        });
        setColorMap(map);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // ⭐️ 개별 색상 저장
  const handleColorSelect = async (targetUserId: string, color: string) => {
    setSavingId(targetUserId);
    setColorMap(prev => ({ ...prev, [targetUserId]: color })); // 즉시 반영

    try {
      await saveColleagueColor(targetUserId, color);
    } catch (error) {
      alert("색상 저장에 실패했습니다.");
    } finally {
      setSavingId(null);
    }
  };

  // ⭐️ 부서 일괄 색상 저장
  const handleDepartmentColorSelect = async (deptName: string, deptProfiles: Profile[], color: string) => {
    setSavingDept(deptName);
    
    // 화면에 즉시 반영 (해당 부서원 전체 색상 변경)
    const newColorMap = { ...colorMap };
    const updates = deptProfiles.map(p => {
      newColorMap[p.id] = color;
      return { target_user_id: p.id, color };
    });
    setColorMap(newColorMap);

    try {
      await saveBulkColleagueColors(updates);
    } catch (error) {
      alert("부서 색상 일괄 저장에 실패했습니다.");
    } finally {
      setSavingDept(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
      <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-6">
        {/* ✅ 뒤로가기 링크 수정됨 */}
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사용자 색상 설정</h1>
          <p className="text-sm text-gray-500 mt-1">
            부서별로 한 번에 색상을 지정하거나, 직원별로 개별 색상을 설정할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedProfiles).map(([deptName, profiles]) => (
          <div key={deptName} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            
            {/* ⭐️ 부서 헤더 (일괄 설정 영역) */}
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-bold text-gray-800">{deptName}</h2>
                <span className="text-sm text-gray-500 font-medium bg-gray-200 px-2 py-0.5 rounded-full">
                  {profiles.length}명
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-400 mr-2">부서 일괄 적용:</span>
                {savingDept === deptName && <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-1" />}
                {PALETTE.map((color) => (
                  <button
                    key={`dept-${color}`}
                    onClick={() => handleDepartmentColorSelect(deptName, profiles, color)}
                    style={{ backgroundColor: color }}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 opacity-70 hover:opacity-100"
                    title={`${deptName} 전체 적용`}
                  />
                ))}
              </div>
            </div>

            {/* 개별 직원 목록 */}
            <div className="divide-y divide-gray-100">
              {profiles.map((profile) => {
                const selectedColor = colorMap[profile.id];

                return (
                  <div key={profile.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3 mb-3 sm:mb-0 pl-2">
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm">
                        {profile.name.charAt(0)}
                      </div>
                      <div className="font-bold text-gray-800">{profile.name}</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {savingId === profile.id && <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />}
                      {PALETTE.map((color) => (
                        <button
                          key={`user-${color}`}
                          onClick={() => handleColorSelect(profile.id, color)}
                          style={{ backgroundColor: color }}
                          className={`
                            w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110
                            ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-800' : 'opacity-40 hover:opacity-100'}
                          `}
                        >
                          {selectedColor === color && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(groupedProfiles).length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            표시할 동료가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
