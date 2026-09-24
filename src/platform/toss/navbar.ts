// 앱인토스 전용 코드(CLAUDE.md 규칙 8) — 앱인토스 안에서는 토스 내비게이션 바가 뒤로가기 버튼을 이미 그려줘요.
// 우리 화면에서 또 그리면 뒤로가기가 두 개 보여서(2026-09-24 검수 반려 사유), 앱인토스 빌드에서는 자체 뒤로가기를 숨겨요.
export function hasTossNavigationBar() {
  return import.meta.env.VITE_PLATFORM === 'toss'
}
