import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { REGION_LABEL } from '../../config/brand'
import { BUNGAE_COPY, COMMENT_COPY, GUEST_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { formatStartsAt, type Bungae } from './bungae-types'
import './BungaePage.css'

type Participant = { user_id: string; status: string }
type BungaeComment = { id: number; body: string; author_id: string | null; created_at: string }

export function BungaeDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [bungae, setBungae] = useState<Bungae | null>(null)
  const [hostNickname, setHostNickname] = useState('알 수 없음')
  const [remaining, setRemaining] = useState(0)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [comments, setComments] = useState<BungaeComment[]>([])
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [commentDraft, setCommentDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  async function load() {
    setLoading(true)
    const { data: b } = await supabase
      .from('bungaes')
      .select('id, host_id, title, body, starts_at, region_code, place_hint, capacity, status, created_at')
      .eq('id', id)
      .maybeSingle()
    if (!b) {
      setLoading(false)
      return
    }
    setBungae(b as Bungae)

    const { data: card } = await supabase.from('profile_cards').select('id, nickname').eq('id', b.host_id).maybeSingle()
    if (card) setHostNickname(card.nickname)

    const { data: n } = await supabase.rpc('get_bungae_remaining_slots', { p_bungae_id: b.id })
    setRemaining((n as number) ?? 0)

    const { data: p } = await supabase.from('bungae_participants').select('user_id, status').eq('bungae_id', b.id)
    setParticipants((p ?? []) as Participant[])

    const { data: c } = await supabase
      .from('bungae_comments')
      .select('id, body, author_id, created_at')
      .eq('bungae_id', b.id)
      .order('created_at', { ascending: true })
    const commentList = (c ?? []) as BungaeComment[]
    setComments(commentList)

    const ids = [...new Set([b.host_id, ...commentList.map((x) => x.author_id).filter((x): x is string => !!x)])]
    if (ids.length > 0) {
      const { data: cards } = await supabase.from('profile_cards').select('id, nickname').in('id', ids)
      const map: Record<string, string> = {}
      for (const c2 of cards ?? []) map[c2.id] = c2.nickname
      setNicknames(map)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p>불러오는 중...</p>
  if (!bungae) return <p>존재하지 않는 소모임이에요.</p>

  const isHost = profile?.id === bungae.host_id
  const isAdmin = profile?.role === 'admin'
  const isParticipant = participants.some((p) => p.user_id === profile?.id && p.status === 'joined')
  const canSeeInner = isHost || isAdmin || isParticipant

  async function handleJoin() {
    if (!profile) {
      navigate('/me')
      return
    }
    setActionError(null)
    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('join_bungae', { p_bungae_id: bungae!.id })
      if (error) throw error
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '참석 신청에 실패했어요')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLeave() {
    setActionError(null)
    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('leave_bungae', { p_bungae_id: bungae!.id })
      if (error) throw error
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '취소에 실패했어요')
    } finally {
      setActionLoading(false)
    }
  }

  async function submitComment() {
    if (!profile) {
      navigate('/me')
      return
    }
    const text = commentDraft.trim()
    if (!text) return
    const { error } = await supabase.from('bungae_comments').insert({
      bungae_id: bungae!.id,
      author_id: profile.id,
      body: text,
    })
    if (!error) {
      setCommentDraft('')
      await load()
    }
  }

  return (
    <section className="bungae-detail-page">
      <Link to="/bungae" className="bungae-back">
        ← {BUNGAE_COPY.backToList}
      </Link>

      <div className="clay-card bungae-detail-card">
        <h1>{bungae.title}</h1>
        <p className="bungae-detail-meta">
          {formatStartsAt(bungae.starts_at)} · {bungae.place_hint ?? REGION_LABEL} · {hostNickname}{' '}
          <span className="bungae-host-badge">{BUNGAE_COPY.hostBadge}</span>
        </p>
        <p className="bungae-detail-body">{bungae.body}</p>
        <p className="bungae-slots">{BUNGAE_COPY.remainingSlots(remaining)}</p>

        {actionError && <p className="bungae-error">{actionError}</p>}

        {!profile ? (
          <button type="button" className="pill-button" onClick={() => navigate('/me')}>
            {GUEST_COPY.ctaLogin}
          </button>
        ) : isParticipant ? (
          <button type="button" className="pill-button-ghost" disabled={actionLoading} onClick={handleLeave}>
            {BUNGAE_COPY.leaveButton}
          </button>
        ) : (
          <button type="button" className="pill-button" disabled={actionLoading || remaining <= 0} onClick={handleJoin}>
            {BUNGAE_COPY.joinButton}
          </button>
        )}
      </div>

      {!canSeeInner ? (
        <p className="bungae-restricted">{BUNGAE_COPY.participantsRestricted}</p>
      ) : (
        <div className="clay-card bungae-comments-card">
          <h2>대화</h2>
          {comments.length === 0 ? (
            <p>{COMMENT_COPY.empty}</p>
          ) : (
            <ul className="feed-comments-list">
              {comments.map((c) => (
                <li key={c.id}>
                  <span className="feed-comment-nickname">{(c.author_id && nicknames[c.author_id]) || '알 수 없음'}</span>
                  <span className="feed-comment-body">{c.body}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="feed-comment-form">
            <input
              className="pill-input"
              placeholder={COMMENT_COPY.placeholder}
              value={commentDraft}
              maxLength={300}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitComment()
              }}
            />
            <button type="button" className="pill-button-ghost" onClick={submitComment}>
              {COMMENT_COPY.submit}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
