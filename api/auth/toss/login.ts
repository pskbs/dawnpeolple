// POST /api/auth/toss/login  { authorizationCode, referrer }
// 앱인토스 미니앱에서 TossAuth.login()으로 받은 인가 코드를 세션으로 바꿔줘요.
// 1) mTLS로 generate-token → login-me 호출해 userKey를 확인하고
// 2) userKey로부터 결정론적인 내부용(가짜) 이메일을 만들어 그 이메일의 Supabase Auth 사용자를 찾거나 새로 만든 뒤
// 3) 매직링크 토큰을 발급해 돌려줘요 — 클라이언트는 이 토큰으로 supabase.auth.verifyOtp()를 호출해 로그인을 완료해요.
// 실제 이메일 발송은 하지 않고(그래서 실제 개인 이메일이 전혀 필요 없어요), 토큰만 서버 간에 주고받아요.
// CLAUDE.md 규칙 4(개인정보 최소 수집): 이름·전화번호·이메일 원문·CI는 절대 저장하지 않아요. 성별만 필요 시 참고용으로 넘겨요.
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { decryptTossField, generateToken, loginMe } from '../../_lib/toss.js'

// 앱인토스 빌드는 dist를 토스가 자체 호스팅해(webBundleDir) 이 API(Vercel)와 origin이 달라 CORS가 필요해요.
// authorizationCode는 실제 토스 로그인에서만 발급되는 10분 만료·1회용 값이라 origin을 막을 필요는 없어요.
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...CORS_HEADERS,
    },
  })
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function syntheticEmailFor(userKey: number) {
  const hash = createHash('sha256').update(String(userKey)).digest('hex').slice(0, 32)
  return `toss-${hash}@toss.dawnpeople.internal`
}

export async function POST(request: Request): Promise<Response> {
  let authorizationCode = ''
  let referrer = ''
  try {
    const body = (await request.json()) as { authorizationCode?: unknown; referrer?: unknown }
    authorizationCode = typeof body.authorizationCode === 'string' ? body.authorizationCode : ''
    referrer = typeof body.referrer === 'string' ? body.referrer : ''
  } catch {
    return json(400, { error: 'invalid_request' })
  }
  if (!authorizationCode) return json(400, { error: 'invalid_request' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    // 값 자체는 절대 로그에 남기지 않고 존재 여부(boolean)만 남겨요 — 어떤 값이 비어있는지, 실제 실행 환경이
    // 무엇인지(production/preview) 확인하기 위한 진단용 로그예요.
    console.error('[toss/login] Supabase 환경변수 없음', {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasViteSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL),
      hasServiceKey: Boolean(serviceKey),
      vercelEnv: process.env.VERCEL_ENV,
      // 이름만(값은 안 남김) — SUPABASE/VITE/TOSS로 시작하는 env가 이 함수에 아예 하나도 안 들어오는지 확인용
      matchingEnvKeys: Object.keys(process.env).filter((k) => /^(SUPABASE|VITE_|TOSS_)/.test(k)),
      totalEnvKeyCount: Object.keys(process.env).length,
    })
    return json(500, { error: 'not_configured' })
  }

  let userKey: number
  let gender: string | null = null
  try {
    const token = await generateToken(authorizationCode, referrer)
    const me = await loginMe(token.accessToken)
    userKey = me.userKey
    if (me.gender) {
      try {
        gender = decryptTossField(me.gender).toLowerCase().startsWith('m') ? 'male' : 'female'
      } catch (err) {
        // 복호화는 참고용(성별 사전 채움)일 뿐이라 실패해도 로그인은 계속 진행해요.
        console.error('[toss/login] 성별 복호화 실패', err instanceof Error ? err.message : err)
      }
    }
  } catch (err) {
    console.error('[toss/login] 토스 API 호출 실패', err instanceof Error ? err.message : err)
    return json(502, { error: 'toss_api_failed' })
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const email = syntheticEmailFor(userKey)

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { toss_user_key: String(userKey), ...(gender ? { toss_gender: gender } : {}) },
  })
  // 이미 있는 사용자면 무시하고 계속 진행(재로그인). 그 외 오류만 실패 처리.
  // status 422 + code 'email_exists'가 Supabase의 정식 신호라 메시지 문자열보다 이걸 우선 확인해요.
  const isExistingUser = createError?.code === 'email_exists' || createError?.status === 422
  if (createError && !isExistingUser) {
    console.error('[toss/login] 사용자 생성 실패', createError.message)
    return json(500, { error: 'server_error' })
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkError || !linkData) {
    console.error('[toss/login] 로그인 토큰 발급 실패', linkError?.message)
    return json(500, { error: 'server_error' })
  }

  return json(200, { email, tokenHash: linkData.properties.hashed_token })
}
