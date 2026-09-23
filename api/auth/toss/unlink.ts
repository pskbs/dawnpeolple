// GET|POST /api/auth/toss/unlink — 토스 로그인 "연결 끊기" 콜백.
// 사용자가 토스앱 설정에서 서비스 연결을 끊거나(UNLINK), 로그인 서비스 약관 동의를 철회하거나
// (WITHDRAWAL_TERMS), 토스 회원을 탈퇴하면(WITHDRAWAL_TOSS) 토스 서버가 이 URL을 호출해요.
// 요청 형식: GET ?userKey=...&referrer=... 또는 POST { userKey, referrer } (JSON).
// 콘솔에 등록한 Basic Auth로 요청을 검증해요(스푸핑 방지) — 이 프로젝트 자체 발급 비밀값이라 mTLS는 필요 없어요.
// CLAUDE.md 절대규칙 4(토스 연결 해제 시 데이터 삭제): profiles.toss_user_key로 사용자를 찾아
// delete_my_account()와 같은 방식으로(admin_delete_account, 0014 마이그레이션) 완전히 삭제해요.
import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

type StorageAdmin = ReturnType<typeof createClient>['storage']

// src/lib/media.ts의 listAll과 동일한 로직(서버용 admin 클라이언트 버전) — dm-media/media 버킷은
// "{폴더}/{하위폴더}/{파일}"처럼 중첩될 수 있어서 재귀적으로 실제 파일 경로까지 내려가야 해요.
async function listAllFiles(storage: StorageAdmin, bucket: string, folder: string): Promise<string[]> {
  const { data } = await storage.from(bucket).list(folder, { limit: 1000 })
  const out: string[] = []
  for (const entry of data ?? []) {
    const full = `${folder}/${entry.name}`
    if (entry.id) out.push(full)
    else out.push(...(await listAllFiles(storage, bucket, full)))
  }
  return out
}

function isAuthorized(request: Request): boolean {
  const expectedUser = process.env.TOSS_UNLINK_CALLBACK_USER
  const expectedPass = process.env.TOSS_UNLINK_CALLBACK_PASS
  if (!expectedUser || !expectedPass) return false
  const header = request.headers.get('authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme !== 'Basic' || !encoded) return false
  let decoded = ''
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8')
  } catch {
    return false
  }
  const separatorIndex = decoded.indexOf(':')
  if (separatorIndex === -1) return false
  const user = decoded.slice(0, separatorIndex)
  const pass = decoded.slice(separatorIndex + 1)
  return safeEqual(user, expectedUser) && safeEqual(pass, expectedPass)
}

async function handleUnlink(request: Request, userKey: string): Promise<Response> {
  if (!isAuthorized(request)) return json(401, { error: 'unauthorized' })
  if (!userKey) return json(400, { error: 'invalid_request' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[toss/unlink] Supabase 환경변수 없음')
    return json(500, { error: 'not_configured' })
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: found, error: findError } = await admin
    .from('profiles')
    .select('id')
    .eq('toss_user_key', userKey)
    .maybeSingle()
  if (findError) {
    console.error('[toss/unlink] 사용자 조회 실패', findError.message)
    return json(500, { error: 'server_error' })
  }
  // 이미 삭제됐거나 모르는 사용자면 조용히 200 — 토스 쪽에 재시도를 유발하지 않아요.
  if (!found) return json(200, { ok: true })

  const userId = found.id as string
  // 대화방 id는 계정 삭제(conversations 행도 함께 삭제됨) 전에 미리 알아둬야 스토리지 폴더를 지울 수 있어요.
  const { data: convs } = await admin.from('conversations').select('id').or(`user_a.eq.${userId},user_b.eq.${userId}`)

  // 신원(프로필·글·계정) 삭제를 스토리지 정리보다 먼저 해요 — 중간에 실패해도
  // "파일은 지워졌는데 계정은 남아있는" 것보다 "계정은 지워졌는데 파일 일부가 남는" 쪽이 안전해요.
  const { error: deleteError } = await admin.rpc('admin_delete_account', { p_user_id: userId })
  if (deleteError) {
    console.error('[toss/unlink] 계정 삭제 실패', deleteError.message)
    return json(500, { error: 'server_error' })
  }

  const mediaPaths = await listAllFiles(admin.storage, 'media', userId)
  if (mediaPaths.length > 0) await admin.storage.from('media').remove(mediaPaths)
  for (const conv of convs ?? []) {
    const paths = await listAllFiles(admin.storage, 'dm-media', String(conv.id))
    if (paths.length > 0) await admin.storage.from('dm-media').remove(paths)
  }

  return json(200, { ok: true })
}

export async function GET(request: Request): Promise<Response> {
  const userKey = new URL(request.url).searchParams.get('userKey') ?? ''
  return handleUnlink(request, userKey)
}

export async function POST(request: Request): Promise<Response> {
  let userKey = ''
  try {
    const body = (await request.json()) as { userKey?: unknown }
    userKey = typeof body.userKey === 'string' ? body.userKey : String(body.userKey ?? '')
  } catch {
    return json(400, { error: 'invalid_request' })
  }
  return handleUnlink(request, userKey)
}
