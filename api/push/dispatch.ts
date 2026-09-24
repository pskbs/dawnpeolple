// POST /api/push/dispatch  (Authorization: Bearer <Supabase access token>)
// 댓글·메시지·소모임 참가·소모임 댓글 직후 클라이언트가 호출해요. 그 사용자가 방금 만든(actor) 알림 중 아직 푸시를
// 안 보낸 것을 DB에서 읽어 토스 스마트 발송으로 보내요. 문구는 DB 트리거가 만든 값만 쓰니 위조할 수 없어요.
// 템플릿 코드(TOSS_PUSH_TEMPLATE_*)가 없거나 받는 사람이 토스 로그인 사용자가 아니면 앱 안 알림만 남기고 건너뛰어요.
import { createClient } from '@supabase/supabase-js'
import { sendTossMessage } from '../_lib/toss.js'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS_HEADERS },
  })
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

type NotificationType = 'comment' | 'comment_reply' | 'bungae_comment' | 'dm' | 'bungae_join'

// 댓글·답글·소모임 댓글은 문구가 같아 "새 댓글" 캠페인 하나로 보내요. 사용자가 받는 알림동의 화면 수를 줄이려는 거예요
// (클라이언트 src/platform/toss/push-consent.ts의 PUSH_TEMPLATE_CODES와 같은 묶음이어야 해요).
const TEMPLATE_ENV: Record<NotificationType, string> = {
  comment: 'TOSS_PUSH_TEMPLATE_COMMENT',
  comment_reply: 'TOSS_PUSH_TEMPLATE_COMMENT',
  bungae_comment: 'TOSS_PUSH_TEMPLATE_COMMENT',
  dm: 'TOSS_PUSH_TEMPLATE_DM',
  bungae_join: 'TOSS_PUSH_TEMPLATE_BUNGAE_JOIN',
}

// 같은 사람이 같은 종류로 연달아 보내면(메시지 여러 개 등) 1분에 푸시 1번만 — 알림 폭탄·발송 비용(건당 과금) 방지.
const THROTTLE_MS = 60 * 1000
// 이보다 오래된 대기 알림은 늦게 울리면 오히려 헷갈려서 푸시 없이 건너뛰어요.
const MAX_AGE_MS = 10 * 60 * 1000
// 푸시에는 작성 내용 앞부분만 보내요(길면 …). 전체 내용은 앱 안 알림에서 봐요.
const PUSH_PREVIEW_MAX = 40
// 참가 알림의 소모임 제목은 고정 문구 옆에 붙어서 짧게 자르는 편이 안전해요.
const PUSH_TITLE_MAX = 20

function clip(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text
}

function contextFor(type: NotificationType, meta: Record<string, unknown>): Record<string, string> {
  // 참가 알림만 "○○님이 '소모임'에 참가했어요" 형태. 나머지(댓글·답글·소모임 댓글·메시지)는 작성 내용만 보여줘요.
  // 콘솔 템플릿에 쓴 변수만 보내요(템플릿에 없는 변수를 보내면 거절될 수 있어요).
  if (type === 'bungae_join') {
    return { nickname: String(meta.nickname ?? '누군가'), title: clip(String(meta.title ?? ''), PUSH_TITLE_MAX) }
  }
  return { preview: clip(String(meta.preview ?? '').replace(/…$/, ''), PUSH_PREVIEW_MAX) }
}

export async function POST(request: Request): Promise<Response> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'unauthorized' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'not_configured' })
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json(401, { error: 'unauthorized' })
  const actorId = userData.user.id

  const since = new Date(Date.now() - MAX_AGE_MS).toISOString()
  const { data: pending } = await admin
    .from('notifications')
    .select('id, user_id, type, meta, created_at')
    .eq('actor_id', actorId)
    .eq('push_status', 'pending')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(10)

  const deploymentId = process.env.TOSS_PUSH_TEST_DEPLOYMENT_ID || undefined
  let sent = 0

  for (const n of pending ?? []) {
    const type = n.type as NotificationType
    // 동시에 두 번 호출돼도 한 번만 보내도록 먼저 선점해요.
    const { data: claimed } = await admin
      .from('notifications')
      .update({ push_status: 'sent' })
      .eq('id', n.id)
      .eq('push_status', 'pending')
      .select('id')
    if (!claimed || claimed.length === 0) continue

    const skip = async () => {
      await admin.from('notifications').update({ push_status: 'skipped' }).eq('id', n.id)
    }

    const templateSetCode = process.env[TEMPLATE_ENV[type]]
    if (!templateSetCode) {
      await skip()
      continue
    }

    const { data: recipient } = await admin.from('profiles').select('toss_user_key').eq('id', n.user_id).maybeSingle()
    if (!recipient?.toss_user_key) {
      await skip()
      continue
    }

    const throttleSince = new Date(Date.now() - THROTTLE_MS).toISOString()
    const { count: recent } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', n.user_id)
      .eq('actor_id', actorId)
      .eq('type', type)
      .eq('push_status', 'sent')
      .neq('id', n.id)
      .gte('created_at', throttleSince)
    if ((recent ?? 0) > 0) {
      await skip()
      continue
    }

    try {
      await sendTossMessage({
        userKey: String(recipient.toss_user_key),
        templateSetCode,
        context: contextFor(type, (n.meta ?? {}) as Record<string, unknown>),
        deploymentId,
      })
      sent += 1
    } catch (err) {
      console.error('[push/dispatch] 발송 실패', err instanceof Error ? err.message : err)
      await admin.from('notifications').update({ push_status: 'failed' }).eq('id', n.id)
    }
  }

  return json(200, { ok: true, sent })
}
