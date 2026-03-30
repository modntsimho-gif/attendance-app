import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AutoLogoutProvider from "@/components/AutoLogoutProvider";
import Script from "next/script";

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
    icon: "/logo.png", // 👈 public 폴더에 넣은 로고 파일의 이름으로 변경해 주세요! (.ico, .png, .svg 모두 가능)
    apple: "/logo.png", // (선택) 아이폰 바탕화면 추가용 아이콘
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
          {children}
        </AutoLogoutProvider>
      </body>
    </html>
  );
}
