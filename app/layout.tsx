import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AutoLogoutProvider from "@/components/AutoLogoutProvider";
import Script from "next/script"; // 👈 Next.js 공식 스크립트 로더 사용

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "[MAW]근테 관리",
  description: "[MAW]근테 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* 👇 1. 라이브러리 대신 여기서 직접 네이버 지도를 불러옵니다 */}
        {/* strategy="beforeInteractive": 페이지가 열리기 전에 지도부터 가져옴 */}
        <Script
          strategy="beforeInteractive"
          src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=zmt8pb1c6n"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 👇 2. NavermapsProvider 제거함 (필요 없음) */}
        <AutoLogoutProvider>
          {children}
        </AutoLogoutProvider>
      </body>
    </html>
  );
}
