// 앱인토스 전용 코드(CLAUDE.md 규칙 8) — Share는 여기서만 직접 다뤄요.
import { Share } from '@apps-in-toss/web-framework'

// apps-in-toss.config.ts의 appName과 같아야 해요.
const APP_NAME = 'dawnpeople'

// Share에는 isSupported()가 없어서(SDK 미제공), 빌드 플랫폼 스위치로 판단해요(login.ts와 동일 패턴).
export function isTossShareSupported() {
  return import.meta.env.VITE_PLATFORM === 'toss'
}

// path는 "/feed/123"처럼 앱 내부 라우트예요. intoss:// 딥링크로 바꿔 토스 공유 링크를 만들고
// 네이티브 공유 시트로 보내요. intoss:// 스킴은 정식 출시 후에만 동작해요 — 출시 전 테스트는
// 콘솔이 주는 테스트 스킴(intoss-private://appsintoss?_deploymentId=...)으로만 가능해요.
export async function shareTossPath(path: string) {
  const link = await Share.createLink({ path: `intoss://${APP_NAME}${path}` })
  await Share.sendMessage({ message: link })
}
