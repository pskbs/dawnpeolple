// POST /api/auth/reset-password  { email }
// 가입한 이메일로 임시 비밀번호를 만들어 메일로 보내요(사용자 요청 2026-09-22, docs/decisions.md).
// - service role 키는 이 서버 함수에서만 써요(클라이언트 노출 금지).
// - 가입 여부를 알 수 없도록, 가입되지 않은 이메일이어도 같은 응답을 돌려줘요.
// - 같은 이메일은 10분에 1번만 요청할 수 있어요(이메일 원문 대신 sha256 해시로 기록).
// - 메일을 먼저 보내고 성공했을 때만 비밀번호를 바꿔요. 메일 발송이 실패해도 기존 비밀번호는 그대로예요.
import { createHash, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const BRAND_NAME = '새벽사람들'
const COOLDOWN_MINUTES = 10
const GLOBAL_HOURLY_LIMIT = 200
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 소문자+숫자만 써서 외우기 쉽게 하고, 헷갈리는 글자(0/o, 1/l)는 빼요.
const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function tempPassword(length = 6) {
  let out = ''
  for (let i = 0; i < length; i++) out += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]
  return out
}

function mailBody(password: string) {
  const text = [
    `안녕하세요, ${BRAND_NAME}이에요.`,
    '',
    '요청하신 새 비밀번호를 보내드려요.',
    '',
    `새 비밀번호: ${password}`,
    '',
    '로그인 방법',
    '1. 앱의 [내정보] 탭에서 가입한 이메일과 위 비밀번호로 로그인해 주세요.',
    '2. 로그인한 뒤 꼭 [내정보 → 설정 → 비밀번호 변경]에서 나만 아는 비밀번호로 바꿔주세요.',
    '',
    '직접 요청하지 않았다면 누군가 이메일 주소를 잘못 입력했을 수 있어요.',
    '위 비밀번호로 로그인한 뒤 비밀번호를 바꿔주시면 안전해요.',
    '',
    `— ${BRAND_NAME} 드림`,
  ].join('\n')

  const html = `<!doctype html>
<html lang="ko"><body style="margin:0;padding:24px;background:#f3f0ff;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#2b2540">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px 24px">
    <p style="margin:0 0 4px;font-size:13px;color:#8465f2;font-weight:700">${BRAND_NAME}</p>
    <h1 style="margin:0 0 16px;font-size:20px">새 비밀번호를 보내드려요</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">요청하신 새 비밀번호예요. 아래 비밀번호로 로그인해 주세요.</p>
    <div style="margin:0 0 20px;padding:16px;border-radius:14px;background:#f3f0ff;text-align:center;font-size:24px;font-weight:800;letter-spacing:2px;color:#5b3fd6">${password}</div>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6"><strong>로그인한 뒤 꼭 비밀번호를 바꿔주세요.</strong></p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5d5670">[내정보 → 설정 → 비밀번호 변경]에서 나만 아는 비밀번호로 바꿀 수 있어요.</p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8c86a0">직접 요청하지 않았다면 누군가 이메일 주소를 잘못 입력했을 수 있어요. 위 비밀번호로 로그인한 뒤 비밀번호를 바꿔주시면 안전해요.</p>
  </div>
</body></html>`

  return { text, html }
}

export async function POST(request: Request): Promise<Response> {
  let email = ''
  try {
    const body = (await request.json()) as { email?: unknown }
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return json(400, { error: 'invalid_request' })
  }
  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { error: 'invalid_email' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  if (!supabaseUrl || !serviceKey || !smtpUser || !smtpPass) {
    console.error('[reset-password] 환경변수가 없어요: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SMTP_USER/SMTP_PASS')
    return json(500, { error: 'not_configured' })
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const emailHash = createHash('sha256').update(email).digest('hex')

  // 요청 횟수 제한: 같은 이메일 10분 1회, 전체 시간당 상한
  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString()
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString()
  const [{ count: recent }, { count: hourly }] = await Promise.all([
    admin.from('password_reset_requests').select('id', { count: 'exact', head: true }).eq('email_hash', emailHash).gte('created_at', since),
    admin.from('password_reset_requests').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo),
  ])
  if ((recent ?? 0) > 0 || (hourly ?? 0) >= GLOBAL_HOURLY_LIMIT) return json(429, { error: 'too_many_requests' })
  await admin.from('password_reset_requests').insert({ email_hash: emailHash })

  const { data: userId, error: findError } = await admin.rpc('find_auth_user_id', { p_email: email })
  if (findError) {
    console.error('[reset-password] 사용자 조회 실패', findError.message)
    return json(500, { error: 'server_error' })
  }
  // 가입되지 않은 이메일도 같은 응답(가입 여부 노출 방지)
  if (!userId) return json(200, { ok: true })

  const password = tempPassword()
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  })

  try {
    const { text, html } = mailBody(password)
    await transporter.sendMail({
      from: `"${BRAND_NAME}" <${process.env.MAIL_FROM || smtpUser}>`,
      to: email,
      subject: `[${BRAND_NAME}] 새 비밀번호를 보내드려요`,
      text,
      html,
    })
  } catch (err) {
    console.error('[reset-password] 메일 발송 실패', err instanceof Error ? err.message : err)
    return json(502, { error: 'mail_failed' })
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId as string, { password })
  if (updateError) {
    console.error('[reset-password] 비밀번호 변경 실패', updateError.message)
    return json(500, { error: 'server_error' })
  }

  return json(200, { ok: true })
}
