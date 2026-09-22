// 앱인토스 전용 코드(CLAUDE.md 규칙 8) — TossAuth는 여기서만 직접 다뤄요.
import { TossAuth } from '@apps-in-toss/web-framework'
import { supabase } from '../../lib/supabase'

// TossAuth.login()에는 isSupported()가 없어서(SDK 미제공), 빌드 플랫폼 스위치로 판단해요.
export function isTossLoginSupported() {
  return import.meta.env.VITE_PLATFORM === 'toss'
}

// TossAuth.login() → 우리 서버(api/auth/toss/login)에서 세션 토큰 발급 → verifyOtp로 로그인 완료.
export async function signInWithToss() {
  const { authorizationCode, referrer } = await TossAuth.login()
  const res = await fetch('/api/auth/toss/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorizationCode, referrer }),
  })
  if (!res.ok) throw new Error('토스 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.')
  const { email, tokenHash } = (await res.json()) as { email: string; tokenHash: string }
  const { error } = await supabase.auth.verifyOtp({ email, token_hash: tokenHash, type: 'magiclink' })
  if (error) throw new Error('토스 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.')
}
