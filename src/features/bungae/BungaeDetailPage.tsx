import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar, Avatar, Icon, Loading } from '../../components/ui'
import { REGION_LABEL } from '../../config/brand'
import { BUNGAE_COPY, COMMENT_COPY, GUEST_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { formatRelativeTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { fetchNicknames } from '../feed/feed-api'
import { dateTileParts, type Bungae } from './bungae-types'
import './BungaePage.css'

type Participant = { user_id: string; status: string }
type BungaeComment = { id: number; body: string; author_id: string | null; created_at: string }

export function BungaeDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [bungae, setBungae] = useState<Bungae | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [comments, setComments] = useState<BungaeComment[]>([])
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [commentDraft, setCommentDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  async function load() {
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

    const [{ data: n }, { data: p }, { data: c }] = await Promise.all([
      supabase.rpc('get_bungae_remaining_slots', { p_bungae_id: b.id }),
      supabase.from('bungae_participants').select('user_id, status').eq('bungae_id', b.id),
      supabase
        .from('bungae_comments')
        .select('id, body, author_id, created_at')
        .eq('bungae_id', b.id)
        .order('created_at', { ascending: true }),
    ])
    setRemaining((n as number) ?? 0)
    setParticipants((p ?? []) as Participant[])
    const commentList = (c ?? []) as BungaeComment[]
    setComments(commentList)
    setNicknames(await fetchNicknames([b.host_id, ...commentList.map((x) => x.author_id)]))
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <section className="bungae-detail-page">
        <AppBar back="/bungae" title={BUNGAE_COPY.listTitle} />
        <Loading />
      </section>
    )
  }

  if (!bungae) {
    return (
      <section className="bungae-detail-page">
        <AppBar back="/bungae" title={BUNGAE_COPY.listTitle} />
        <div className="empty-state">
          <span className="orb orb--md" aria-hidden="true" />
          <p>{BUNGAE_COPY.notFound}</p>
        </div>
      </section>
    )
  }

  const isHost = profile?.id === bungae.host_id
  const isAdmin = profile?.role === 'admin'
  const isParticipant = participants.some((p) => p.user_id === profile?.id && p.status === 'joined')
  const canSeeInner = isHost || isAdmin || isParticipant
  const joined = Math.max(0, bungae.capacity - remaining)
  const tile = dateTileParts(bungae.starts_at)
  const hostName = nicknames[bungae.host_id] ?? '알 수 없음'
  const nick = (authorId: string | null) => (authorId && nicknames[authorId]) || '알 수 없음'

  async function runAction(rpc: 'join_bungae' | 'leave_bungae', fallback: string) {
    if (!profile) {
      navigate('/me')
      return
    }
    setActionError(null)
    setActionLoading(true)
    try {
      const { error } = await supabase.rpc(rpc, { p_bungae_id: bungae!.id })
      if (error) throw error
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallback)
    } finally {
      setActionLoading(false)
    }
  }

  async function submitComment() {
    if (!profile) return
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
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="bungae-detail-page">
      <AppBar back="/bungae" title={BUNGAE_COPY.listTitle} />

      <article className="glass-panel bungae-detail-card">
        <div className="bungae-card__top">
          <span className="date-tile date-tile--lg">
            <strong>{tile.day}</strong>
            <small>{tile.weekday}</small>
          </span>
          <div className="bungae-card__heading">
            <h1>{bungae.title}</h1>
            <div className="bungae-meta">
              <span>
                <Icon name="clock-icon" />
                {tile.time}
              </span>
              <span>
                <Icon name="pin-icon" />
                {bungae.place_hint ?? REGION_LABEL}
              </span>
            </div>
          </div>
        </div>

        <p className="bungae-detail-body">{bungae.body}</p>

        <div className="bungae-host bungae-host--detail">
          <Avatar name={hostName} seed={bungae.host_id} size="sm" />
          <span>{BUNGAE_COPY.hostedBy(hostName)}</span>
          <span className="badge">{BUNGAE_COPY.hostBadge}</span>
        </div>
      </article>

      <div className="glass-panel seats-card">
        <div className="seats-card__head">
          <span className="field-label">{BUNGAE_COPY.seatsTitle}</span>
          <strong>{BUNGAE_COPY.seatsCount(joined, bungae.capacity)}</strong>
        </div>
        <div className="seat-dots" aria-hidden="true">
          {Array.from({ length: bungae.capacity }, (_, i) => (
            <span key={i} className={i < joined ? 'seat-dot seat-dot--on' : 'seat-dot'} />
          ))}
        </div>
        <div className="seats-card__foot">
          <span className={`bungae-slots${remaining <= 0 ? ' bungae-slots--full' : ''}`}>
            {BUNGAE_COPY.remainingSlots(remaining)}
          </span>
          {isParticipant && (
            <button
              type="button"
              className="pill-button-ghost"
              disabled={actionLoading}
              onClick={() => runAction('leave_bungae', '취소에 실패했어요')}
            >
              {BUNGAE_COPY.leaveButton}
            </button>
          )}
        </div>
        {actionError && <p className="error-text">{actionError}</p>}
      </div>

      {!canSeeInner ? (
        <div className="glass-panel bungae-restricted">
          <span className="circle-button" aria-hidden="true">
            <Icon name="lock-icon" />
          </span>
          <p>{BUNGAE_COPY.participantsRestricted}</p>
        </div>
      ) : (
        <div className="bungae-chat">
          <h2 className="bungae-chat__title">{BUNGAE_COPY.chatTitle}</h2>
          {comments.length === 0 ? (
            <p className="bungae-chat__empty">{BUNGAE_COPY.chatEmpty}</p>
          ) : (
            <ul className="chat-list">
              {comments.map((c) => {
                const mine = c.author_id === profile?.id
                return (
                  <li key={c.id} className={`chat-row${mine ? ' chat-row--mine' : ''}`}>
                    {!mine && <Avatar name={nick(c.author_id)} seed={c.author_id} size="sm" />}
                    <div className="chat-bubble-wrap">
                      {!mine && <span className="chat-name">{nick(c.author_id)}</span>}
                      <div className="chat-bubble">
                        <p>{c.body}</p>
                        <span className="chat-time">{formatRelativeTime(c.created_at)}</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      <div className="bottom-bar">
        {!profile ? (
          <button type="button" className="pill-button pill-button--block" onClick={() => navigate('/me')}>
            {GUEST_COPY.ctaLogin}
          </button>
        ) : canSeeInner ? (
          <form
            className="composer-bar"
            onSubmit={(e) => {
              e.preventDefault()
              submitComment()
            }}
          >
            <Avatar name={profile.nickname} seed={profile.id} size="sm" />
            <input
              placeholder={COMMENT_COPY.placeholder}
              aria-label={COMMENT_COPY.placeholder}
              value={commentDraft}
              maxLength={300}
              onChange={(e) => setCommentDraft(e.target.value)}
            />
            <button
              type="submit"
              className="circle-button circle-button--primary circle-button--sm"
              disabled={!commentDraft.trim()}
              aria-label={COMMENT_COPY.submit}
            >
              <Icon name="arrow-up-icon" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="pill-button pill-button--block"
            disabled={actionLoading || remaining <= 0}
            onClick={() => runAction('join_bungae', '참석 신청에 실패했어요')}
          >
            {BUNGAE_COPY.joinButton}
          </button>
        )}
      </div>
    </section>
  )
}
