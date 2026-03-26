// app/location/page.tsx (또는 해당 경로)
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import LocationManager from "@/components/LocationManager"; 

export default async function LocationSetupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. 여기서 데이터를 가져오는 건 그대로 유지합니다. (서버 컴포넌트의 장점)
  const { data: employees, error } = await supabase
    .from("profiles")
    .select(`
      *,
      work_locations (
        id,
        name,
        latitude,
        longitude
      )
    `)
    .order("name", { ascending: true });

  if (error) {
    console.error("Supabase Query Error:", JSON.stringify(error, null, 2));
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">근무지 위치 설정</h1>
            <p className="text-gray-500 text-sm">
              재택, 본사 등 여러 근무지를 등록하여 유연하게 출퇴근하세요.
            </p>
          </div>
        </div>

        {/* 2. LocationManager에게 '내 ID'와 '전체 직원 데이터'를 모두 넘깁니다. */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            근무지 통합 관리
          </h2>
          
          {user ? (
            <LocationManager 
                userId={user.id} 
                initialAllEmployees={employees || []} // 👈 핵심: 데이터를 props로 전달
            />
          ) : (
            <div className="text-red-500">로그인이 필요합니다.</div>
          )}
        </div>

      </div>
    </main>
  );
}
