import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../../components/toast'
import { AppBar, Loading } from '../../components/ui'
import { ADMIN_COPY } from '../../config/copy'
import { FEATURES } from '../../config/features'
import { useAuth } from '../../lib/auth-context'
import { formatRelativeTime } from '../../lib/format'
import { fetchProfileCards } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import './AdminPage.css'

type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed'
type Filter = ReportStatus | 'all'
type TargetType = keyof typeof ADMIN_COPY.targetLabels

type ReportRow = {
  id: number
  created_at: string
  status: ReportStatus
  target_type: TargetType
  target_id: string
  reason: string
  detail: string | null
  reporter_nickname: string | null
}

// 신고 대상의 미리보기. hidden이면 숨김 처리된 상태예요.
type TargetInfo = { text: string; link: string | null; hidden: boolean; missing: boolean }

const FILTERS: Filter[] = ['pending', 'reviewing', 'resolved', 'dismissed', 'all']

// 대상별 테이블과 "숨김" 상태값. 소모임은 hidden 상태가 없어 cancelled로 내려요.
const HIDE_RULES: Partial<Record<TargetType, { table: string; hidden: string; visible: string }>> = {
  post: { table: 'posts', hidden: 'hidden', visible: 'visible' },
  comment: { table: 'comments', hidden: 'hidden', visible: 'visible' },
  bungae_comment: { table: 'bungae_comments', hidden: 'hidden', visible: 'visible' },
  bungae: { table: 'bungaes', hidden: 'cancelled', visible: 'open' },
}

function keyOf(r: Pick<ReportRow, 'target_type' | 'target_id'>) {
  return `${r.target_type}:${r.target_id}`
}

async function loadTargets(rows: ReportRow[]): Promise<Record<string, TargetInfo>> {
  const idsOf = (type: TargetType) => [...new Set(rows.filter((r) => r.target_type === type).map((r) => r.target_id))]
  const numeric = (ids: string[]) => ids.map(Number).filter((n) => Number.isFinite(n))

  const [posts, comments, bungaes, bungaeComments, users] = await Promise.all([
    supabase.from('posts').select('id, body, status').in('id', numeric(idsOf('post'))),
    supabase.from('comments').select('id, body, status, post_id').in('id', numeric(idsOf('comment'))),
    supabase.from('bungaes').select('id, title, status').in('id', numeric(idsOf('bungae'))),
    supabase.from('bungae_comments').select('id, body, status, bungae_id').in('id', numeric(idsOf('bungae_comment'))),
    fetchProfileCards(idsOf('user')),
  ])

  const out: Record<string, TargetInfo> = {}
  for (const p of posts.data ?? [])
    out[`post:${p.id}`] = { text: p.body || '(사진만 있는 글)', link: `/feed/${p.id}`, hidden: p.status !== 'visible', missing: false }
  for (const c of comments.data ?? [])
    out[`comment:${c.id}`] = { text: c.body || '(사진만 있는 답글)', link: `/feed/${c.post_id}`, hidden: c.status !== 'visible', missing: false }
  for (const b of bungaes.data ?? [])
    out[`bungae:${b.id}`] = { text: b.title, link: `/bungae/${b.id}`, hidden: b.status === 'cancelled', missing: false }
  for (const c of bungaeComments.data ?? [])
    out[`bungae_comment:${c.id}`] = { text: c.body || '(사진만 있는 대화)', link: `/bungae/${c.bungae_id}`, hidden: c.status !== 'visible', missing: false }
  for (const [id, card] of Object.entries(users))
    out[`user:${id}`] = { text: card.nickname, link: `/u/${id}`, hidden: false, missing: false }

  for (const r of rows) {
    out[keyOf(r)] ??= { text: ADMIN_COPY.deleted, link: null, hidden: false, missing: true }
  }
  return out
}

export function AdminReportsPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = (searchParams.get('status') as Filter) || 'pending'
  const [rows, setRows] = useState<ReportRow[]>([])
  const [targets, setTargets] = useState<Record<string, TargetInfo>>({})
  const [loading, setLoading] = useState(true)
  const isAdmin = profile?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('reports_overview')
      .select('id, created_at, status, target_type, target_id, reason, detail, reporter_nickname')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query
    const list = (data ?? []) as ReportRow[]
    setRows(list)
    setTargets(await loadTargets(list))
    setLoading(false)
  }, [filter])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  if (!FEATURES.admin || !profile) return <Navigate to="/me" replace />
  if (!isAdmin) return <Navigate to="/me" replace />

  async function setStatus(row: ReportRow, status: ReportStatus) {
    const { error } = await supabase.from('reports').update({ status }).eq('id', row.id)
    if (error) return toast.show(ADMIN_COPY.updateError)
    setRows((prev) => (filter === 'all' ? prev.map((r) => (r.id === row.id ? { ...r, status } : r)) : prev.filter((r) => r.id !== row.id)))
  }

  async function toggleHidden(row: ReportRow) {
    const rule = HIDE_RULES[row.target_type]
    const info = targets[keyOf(row)]
    if (!rule || !info) return
    const nextHidden = !info.hidden
    const { error } = await supabase
      .from(rule.table)
      .update({ status: nextHidden ? rule.hidden : rule.visible })
      .eq('id', Number(row.target_id))
    if (error) return toast.show(ADMIN_COPY.updateError)
    setTargets((prev) => ({ ...prev, [keyOf(row)]: { ...info, hidden: nextHidden } }))
  }

  const sameTargetCount = rows.reduce<Record<string, number>>((acc, r) => {
    acc[keyOf(r)] = (acc[keyOf(r)] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="admin-page">
      <AppBar back="/me/settings" title={ADMIN_COPY.title} />
      <p className="admin-notice">{ADMIN_COPY.notice}</p>

      <div className="chip-row admin-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            className="chip"
            onClick={() => setSearchParams(f === 'pending' ? {} : { status: f }, { replace: true })}
          >
            {ADMIN_COPY.statusLabels[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>{ADMIN_COPY.empty}</p>
        </div>
      ) : (
        <ul className="admin-list">
          {rows.map((r) => {
            const info = targets[keyOf(r)]
            const canHide = !!HIDE_RULES[r.target_type] && info && !info.missing
            const count = sameTargetCount[keyOf(r)] ?? 1
            return (
              <li key={r.id} className="glass-panel admin-card">
                <div className="admin-card__head">
                  <span className="badge">{ADMIN_COPY.targetLabels[r.target_type] ?? r.target_type}</span>
                  <span className={`admin-status admin-status--${r.status}`}>{ADMIN_COPY.statusLabels[r.status]}</span>
                  <span className="muted admin-card__time">{formatRelativeTime(r.created_at)}</span>
                </div>

                <strong className="admin-card__reason">{r.reason}</strong>
                {r.detail && (
                  <p className="admin-card__detail">
                    <span className="muted">{ADMIN_COPY.detail}</span>
                    {r.detail}
                  </p>
                )}

                <div className={`admin-target${info?.hidden ? ' admin-target--hidden' : ''}`}>
                  <p className="admin-target__text">{info?.text}</p>
                  {info?.hidden && <span className="admin-target__flag">{ADMIN_COPY.hidden}</span>}
                </div>

                <p className="admin-card__meta muted">
                  {ADMIN_COPY.reporter}: {r.reporter_nickname ?? '-'}
                  {count > 1 && ` · ${ADMIN_COPY.sameTarget(count)}`}
                </p>

                <div className="admin-card__actions">
                  {info?.link && (
                    <Link to={info.link} className="pill-button-ghost pill-button-ghost--sm">
                      {ADMIN_COPY.open}
                    </Link>
                  )}
                  {canHide && (
                    <button type="button" className="pill-button-ghost pill-button-ghost--sm" onClick={() => toggleHidden(r)}>
                      {info.hidden ? ADMIN_COPY.unhide : ADMIN_COPY.hide}
                    </button>
                  )}
                  {r.status === 'pending' && (
                    <button type="button" className="pill-button-ghost pill-button-ghost--sm" onClick={() => setStatus(r, 'reviewing')}>
                      {ADMIN_COPY.markReviewing}
                    </button>
                  )}
                  {r.status !== 'resolved' && (
                    <button type="button" className="pill-button pill-button--sm" onClick={() => setStatus(r, 'resolved')}>
                      {ADMIN_COPY.markResolved}
                    </button>
                  )}
                  {r.status !== 'dismissed' && (
                    <button type="button" className="pill-button-ghost pill-button-ghost--sm" onClick={() => setStatus(r, 'dismissed')}>
                      {ADMIN_COPY.markDismissed}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
