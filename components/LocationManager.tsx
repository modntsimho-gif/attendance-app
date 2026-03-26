"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Trash2, Home, Building, Save, MapPin, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { NavermapsProvider } from "react-naver-maps";
import MapPicker from "./MapPicker";

interface Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

// 👇 props 타입 정의 추가
interface Props {
  userId: string;
  initialAllEmployees: any[]; // Supabase에서 넘어온 데이터 타입
}

export default function LocationManager({ userId, initialAllEmployees }: Props) {
  const [loading, setLoading] = useState(false);
  const [myLocations, setMyLocations] = useState<Location[]>([]); // 내 근무지 목록
  
  const [locationName, setLocationName] = useState("");
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);

  // 지도 이동을 위한 핵심 state
  const [focusLocation, setFocusLocation] = useState<{ lat: number; lng: number } | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

  // 내 근무지 가져오기
  const fetchMyLocations = async () => {
    const { data } = await supabase
      .from("work_locations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    
    if (data) setMyLocations(data);
  };

  useEffect(() => {
    if (userId) fetchMyLocations();
  }, [userId]);

  const handleRegister = async () => {
    if (!locationName.trim()) return alert("이름을 입력해주세요.");
    if (!selectedLat || !selectedLng) return alert("위치를 선택해주세요.");

    setLoading(true);
    try {
      const { error } = await supabase.from("work_locations").insert({
        user_id: userId,
        name: locationName,
        latitude: selectedLat,
        longitude: selectedLng,
      });

      if (error) throw error;

      alert("등록되었습니다.");
      setLocationName("");
      setSelectedLat(null);
      setSelectedLng(null);
      fetchMyLocations(); // 내 목록 갱신
      router.refresh();   // 부모 데이터(전체 직원)도 갱신될 수 있게
    } catch (err: any) {
      alert("오류: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("work_locations").delete().eq("id", id);
    fetchMyLocations();
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* 1. 지도 및 등록 폼 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 지도 */}
        <div className="lg:col-span-2 h-[400px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <NavermapsProvider ncpClientId={NAVER_CLIENT_ID || "dummy"}>
                <MapPicker 
                    onLocationSelect={(lat, lng) => {
                        setSelectedLat(lat);
                        setSelectedLng(lng);
                    }}
                    selectedLocation={focusLocation}
                />
            </NavermapsProvider>
        </div>

        {/* 오른쪽: 입력 폼 & 내 목록 */}
        <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h3 className="font-bold text-gray-700 mb-3 text-sm">새 근무지 등록</h3>
                <div className="space-y-3">
                    <input
                        type="text"
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                        placeholder="예: 판교 오피스"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <div className="text-xs text-gray-500 font-mono bg-white px-3 py-2 border rounded-lg">
                        {selectedLat ? `${selectedLat.toFixed(5)}, ${selectedLng?.toFixed(5)}` : "지도에서 선택하세요"}
                    </div>
                    <button
                        onClick={handleRegister}
                        disabled={loading || !selectedLat}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:bg-gray-300"
                    >
                        {loading ? "저장 중..." : "저장하기"}
                    </button>
                </div>
            </div>

            {/* 내 근무지 리스트 (간소화) */}
            <div>
                <h3 className="font-bold text-gray-700 mb-2 text-sm">내 등록된 위치</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {myLocations.map(loc => (
                        <div key={loc.id} className="flex justify-between items-center p-2 bg-white border rounded-lg text-sm">
                            <span 
                                className="cursor-pointer hover:text-blue-600 font-medium"
                                onClick={() => setFocusLocation({ lat: loc.latitude, lng: loc.longitude })}
                            >
                                {loc.name}
                            </span>
                            <button onClick={() => handleDelete(loc.id)} className="text-gray-400 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* 2. 전체 직원 근무지 현황 (부모에게서 받은 props로 렌더링) */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-500" />
            전체 직원 근무지 현황
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {initialAllEmployees.map((emp) => {
                const locations = emp.work_locations || [];
                const hasLocations = locations.length > 0;

                return (
                    <div key={emp.id} className="p-4 border rounded-xl bg-white hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                                {emp.avatar_url ? <img src={emp.avatar_url} className="w-full h-full rounded-full object-cover"/> : emp.name.slice(0,1)}
                            </div>
                            <div>
                                <div className="font-bold text-gray-900">{emp.name}</div>
                                <div className="text-xs text-gray-500">{emp.department} {emp.position}</div>
                            </div>
                        </div>

                        {/* 근무지 뱃지들 */}
                        <div className="flex flex-wrap gap-2">
                            {hasLocations ? locations.map((loc: any) => (
                                <button
                                    key={loc.id}
                                    // 👇 핵심: 클릭 시 상단의 지도를 이동시킴!
                                    onClick={() => {
                                        setFocusLocation({ lat: loc.latitude, lng: loc.longitude });
                                        // 부드럽게 위로 스크롤
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs hover:bg-blue-100 transition-colors"
                                >
                                    {loc.name.includes("집") ? <Home className="w-3 h-3" /> : <Building className="w-3 h-3" />}
                                    <span className="font-bold">{loc.name}</span>
                                </button>
                            )) : (
                                <span className="text-xs text-gray-400">등록된 근무지 없음</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
}
