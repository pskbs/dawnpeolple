// api/ 서버리스 함수 호출용 절대 URL 헬퍼.
// 웹 배포는 Vercel이 정적 파일+api를 같은 도메인에서 서빙해 상대경로(/api/...)로 충분하지만,
// 앱인토스 빌드(apps-in-toss.config.ts의 webBundleDir)는 dist를 토스가 자체 호스팅해 페이지 origin이
// Vercel과 달라져요 — 그래서 상대경로로는 api에 닿지 않아요(VITE_PLATFORM=toss일 때 VITE_API_BASE_URL 필수).
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}
