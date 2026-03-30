import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '[MAW] 근태 관리 시스템',
    short_name: 'MAW 근태',
    description: 'Make-A-Wish 근태 관리 프로그램',
    start_url: '/',
    display: 'standalone', // 👈 이 설정이 있어야 브라우저 UI 없이 독립된 앱처럼 열립니다.
    background_color: '#ffffff',
    theme_color: '#0057b7', // Make-A-Wish 파란색 테마
    icons: [
      {
        src: '/logo.png', // public 폴더에 있는 로고 파일 이름
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
