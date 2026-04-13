import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AutoLogoutProvider from "@/components/AutoLogoutProvider";
import PWAInstallGuard from "@/components/PWAInstallGuard"; // 👈 1. 가드 컴포넌트 불러오기
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ⭐️ 메타데이터에 icons 속성을 추가합니다.
export const metadata: Metadata = {
  title: "[MAW]Management System",
  description: "[MAW]Management System",
  icons: {
    icon: "/logo.png", 
    apple: "/logo.png", 
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          strategy="beforeInteractive"
          src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=zmt8pb1c6n"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AutoLogoutProvider>
          {/* 👈 2. 앱 전체를 가드로 감싸주기 */}
          <PWAInstallGuard>
            {children}
          </PWAInstallGuard>
        </AutoLogoutProvider>

        <Analytics />
      </body>
    </html>
  );
}
