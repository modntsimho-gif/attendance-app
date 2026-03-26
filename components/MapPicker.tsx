"use client";

import { useState, useEffect } from "react";
import { Container as MapDiv, NaverMap, Marker, useNavermaps, Listener } from "react-naver-maps";

interface Coord {
  lat: number;
  lng: number;
}

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation?: Coord | null;
}

function MyMap({ onLocationSelect, selectedLocation }: MapPickerProps) {
  const navermaps = useNavermaps();
  
  // 기본값: 서울 (강남역 부근)
  const defaultCenter = new navermaps.LatLng(37.4979, 127.0276);
  
  const [center, setCenter] = useState<any>(defaultCenter);
  const [markerPosition, setMarkerPosition] = useState<any>(null);

  // 1. 외부(리스트 클릭)에서 위치가 변경되면 지도 중심 이동
  useEffect(() => {
    if (selectedLocation) {
      const newCenter = new navermaps.LatLng(selectedLocation.lat, selectedLocation.lng);
      setCenter(newCenter);
      setMarkerPosition(newCenter);
    }
  }, [selectedLocation, navermaps]);

  // 2. 내 위치 가져오기 (처음 한 번만, 외부 선택 없을 때)
  useEffect(() => {
    if (!selectedLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newPos = new navermaps.LatLng(latitude, longitude);
          setCenter(newPos);
          // 내 위치에는 마커를 찍지 않고 중심만 이동 (선택은 유저가 클릭해서)
        },
        (error) => console.warn("위치 정보 실패:", error.message)
      );
    }
  }, []);

  return (
    <NaverMap
      center={center}
      defaultZoom={15}
      // 👇 드래그 시 지도가 버벅이지 않도록 중심점 상태 업데이트
      onCenterChanged={(nextCenter) => setCenter(nextCenter)}
    >
      <Listener 
        type="click" 
        listener={(e: any) => {
          const lat = e.coord.lat();
          const lng = e.coord.lng();
          
          setMarkerPosition(e.coord); // 마커 찍기
          onLocationSelect(lat, lng); // 부모에게 알림
        }}
      />
      
      {markerPosition && <Marker position={markerPosition} />}
    </NaverMap>
  );
}

export default function MapPicker({ onLocationSelect, selectedLocation }: MapPickerProps) {
  return (
    // 👇 [핵심 수정] h-[300px] -> h-full (부모 높이 400px를 꽉 채움)
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-gray-300">
      <MapDiv style={{ width: "100%", height: "100%" }}>
        <MyMap onLocationSelect={onLocationSelect} selectedLocation={selectedLocation} />
      </MapDiv>
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[100] bg-white/90 px-3 py-1.5 rounded-full text-xs font-bold shadow-md text-gray-600 pointer-events-none border border-gray-200">
        📍 지도를 클릭하여 위치를 지정하세요
      </div>
    </div>
  );
}
