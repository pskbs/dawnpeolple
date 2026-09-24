// 앱인토스 전용 코드(CLAUDE.md 규칙 8) — 알림동의문 SDK는 여기서만 직접 다뤄요.
import { Notification as TossNotification } from '@apps-in-toss/web-framework'

// 기능성 푸시는 사용자가 동의해야 보낼 수 있어요. 동의는 캠페인(발송 코드)마다 따로 받을 수 있어서,
// 동의 화면이 여러 번 뜨지 않도록 문구가 같은 댓글·답글·소모임 댓글은 "새 댓글" 캠페인 하나로 보내요
// (서버 api/push/dispatch.ts의 TEMPLATE_ENV와 같은 묶음이에요).
// 발송 코드는 비밀값이 아니에요(콘솔 스마트 발송 → 기능성 캠페인의 코드와 같아야 해요).
export const PUSH_TEMPLATE_CODES = {
  comment: 'dawnpeople-comment',
  comment_reply: 'dawnpeople-comment',
  bungae_comment: 'dawnpeople-comment',
  dm: 'dawnpeople-dm',
  bungae_join: 'dawnpeople-bungae-join',
} as const

export type PushTemplateKey = keyof typeof PUSH_TEMPLATE_CODES

export type PushConsentResult = 'newAgreement' | 'alreadyAgreed' | 'agreementRejected' | 'failed'

// 토스 앱 안이고 동의 화면을 지원하는 버전(5.255.0 이상)일 때만 true예요.
export function isTossPushConsentSupported() {
  if (import.meta.env.VITE_PLATFORM !== 'toss') return false
  try {
    return TossNotification.requestAgreement.isSupported()
  } catch {
    return false
  }
}

// 여러 종류를 한꺼번에 요청해도 같은 캠페인은 한 번만 물어요. 하나라도 실패하면 거기서 멈춰요.
export async function requestTossPushAgreements(keys: PushTemplateKey[]): Promise<PushConsentResult[]> {
  const codes = [...new Set(keys.map((key) => PUSH_TEMPLATE_CODES[key]))]
  const results: PushConsentResult[] = []
  for (const code of codes) {
    const result = await requestAgreement(code)
    results.push(result)
    if (result === 'failed') break
  }
  return results
}

// 동의 화면을 띄우고 결과를 돌려줘요. 이미 동의한 캠페인은 화면 없이 'alreadyAgreed'예요.
function requestAgreement(templateCode: string): Promise<PushConsentResult> {
  return new Promise((resolve) => {
    let cleanup: (() => void) | undefined
    let done = false
    const finish = (result: PushConsentResult) => {
      if (done) return
      done = true
      cleanup?.()
      resolve(result)
    }
    try {
      cleanup = TossNotification.requestAgreement({
        options: { templateCode },
        onEvent: ({ type }) => finish(type),
        onError: () => finish('failed'),
      })
      if (done) cleanup?.()
    } catch {
      finish('failed')
    }
  })
}
