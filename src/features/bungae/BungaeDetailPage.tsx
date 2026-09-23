import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BannerAd } from '../../components/BannerAd'
import { MoreMenu } from '../../components/MoreMenu'
import { AppBar, Avatar, Icon, Loading, ProfileLink } from '../../components/ui'
import { BUNGAE_COPY, GUEST_COPY } from '../../config/copy'
import { FEATURES } from '../../config/features'
import { useAuth } from '../../lib/auth-context'
import { fetchProfileCard, GENDER_LABELS, UNKNOWN_NICKNAME, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { CommentSection } from '../comments/CommentSection'
import { BUNGAE_COLUMNS, dateTileParts, type Bungae } from './bungae-types'
import './BungaePage.css'

type Demographic = { gender: string | null; age_band: string | null; cnt: number }
type Participant = {
  user_id: string
  nickname: string
  avatar_url: string | null
  gender: string | null
  age_band: string | null
  is_host: boolean
}

// "남성(30대)" 형태. 성별이나 연령대가 없으면 있는 것만 보여줘요.
function demographicLabel(gender: string | null, ageBand: string | null) {
  const g = gender ? (GENDER_LABELS[gender] ?? gender) : null
  if (g && ageBand) return `${g}(${ageBand})`
  return g ?? ageBand ?? ''
}

// 집계(성별·연령대별 인원)를 한 사람씩 펼쳐 "남성(30대), 여성(20대)…"처럼 나열해요. 닉네임 등 개인 식별 정보는 없어요.
function expandDemographics(rows: Demographic[]) {
  return rows
    .flatMap((r) => Array.from({ length: r.cnt }, () => demographicLabel(r.gender, r.age_band)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ko'))
}

export function BungaeDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [bungae, setBungae] = useState<Bungae | null>(null)
  const [host, setHost] = useState<ProfileCard | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [isParticipant, setIsParticipant] = useState(false)
  const [demographics, setDemographics] = useState<Demographic[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    const { data: b } = await supabase.from('bungaes').select(BUNGAE_COLUMNS).eq('id', Number(id)).maybeSingle()
    if (!b) {
      setBungae(null)
      setLoading(false)
      return
    }
    const row = b as Bungae
    setBungae(row)

    const [{ data: n }, { data: mine }, { data: demo }, { data: people }, hostCard] = await Promise.all([
      supabase.rpc('get_bungae_remaining_slots', { p_bungae_id: row.id }),
      profile
        ? supabase
            .from('bungae_participants')
            .select('user_id')
            .eq('bungae_id', row.id)
            .eq('user_id', profile.id)
            .eq('status', 'joined')
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.rpc('get_bungae_demographics', { p_bungae_id: row.id }),
      // 참석자·리더·관리자가 아니면 빈 결과가 와요(서버에서 제한).
      profile ? supabase.rpc('get_bungae_participants', { p_bungae_id: row.id }) : Promise.resolve({ data: [] }),
      fetchProfileCard(row.host_id),
    ])
    setRemaining((n as number) ?? 0)
    setIsParticipant(!!mine)
    setDemographics((demo ?? []) as Demographic[])
    setParticipants((people ?? []) as Participant[])
    setHost(hostCard)
    setLoading(false)
  }, [id, profile])

  useEffect(() => {
    load()
  }, [load])

  if (loading || !bungae) {
    return (
      <section className="bungae-detail-page">
        <AppBar back="/bungae" title={BUNGAE_COPY.listTitle} />
        {loading ? (
          <Loading />
        ) : (
          <div className="empty-state">
            <span className="orb orb--md" aria-hidden="true" />
            <p>{BUNGAE_COPY.notFound}</p>
          </div>
        )}
      </section>
    )
  }

  const isHost = profile?.id === bungae.host_id
  const isAdmin = profile?.role === 'admin'
  const canSeeInner = isHost || isAdmin || isParticipant
  const joined = Math.max(0, bungae.capacity - remaining)
  const tile = dateTileParts(bungae.starts_at)
  const hostName = host?.nickname ?? UNKNOWN_NICKNAME
  const attendeeLabels = expandDemographics(demographics)
  const showDemographics = (FEATURES.preJoinDemographics || canSeeInner) && attendeeLabels.length > 0

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

  const joinBar = (
    <button
      type="button"
      className="pill-button pill-button--block"
      disabled={actionLoading || remaining <= 0}
      onClick={() => (profile ? runAction('join_bungae', BUNGAE_COPY.joinError) : navigate('/me'))}
    >
      {profile ? BUNGAE_COPY.joinButton : GUEST_COPY.ctaLogin}
    </button>
  )

  return (
    <section className="bungae-detail-page">
      <AppBar
        back="/bungae"
        title={BUNGAE_COPY.listTitle}
        right={
          <MoreMenu
            isMine={isHost}
            authorId={bungae.host_id}
            authorName={hostName}
            report={{ type: 'bungae', id: bungae.id }}
          />
        }
      />

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
                {bungae.place_hint ?? `${bungae.sido} ${bungae.sigungu} ${bungae.eupmyeondong ?? ''}`.trim()}
              </span>
            </div>
          </div>
        </div>

        <p className="bungae-detail-body">{bungae.body}</p>

        <ProfileLink userId={bungae.host_id} className="bungae-host bungae-host--detail">
          <Avatar name={hostName} seed={bungae.host_id} src={host?.avatar_url} size="sm" />
          <span>{BUNGAE_COPY.hostedBy(hostName)}</span>
          <span className="badge">{BUNGAE_COPY.hostBadge}</span>
        </ProfileLink>
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
          {isParticipant && !isHost && (
            <button
              type="button"
              className="pill-button-ghost"
              disabled={actionLoading}
              onClick={() => runAction('leave_bungae', BUNGAE_COPY.leaveError)}
            >
              {BUNGAE_COPY.leaveButton}
            </button>
          )}
        </div>

        {showDemographics && (
          <div className="demographics" data-testid="bungae-demographics">
            <span className="demographics__title">{BUNGAE_COPY.demographicsTitle}</span>
            <p className="demographics__people">{attendeeLabels.join(', ')}</p>
            {!canSeeInner && <span className="demographics__note">{BUNGAE_COPY.demographicsNote}</span>}
          </div>
        )}

        {canSeeInner && participants.length > 0 && (
          <ul className="participant-list" aria-label={BUNGAE_COPY.participantsTitle}>
            {participants.map((p) => (
              <li key={p.user_id} className="participant">
                <ProfileLink userId={p.user_id}>
                  <Avatar name={p.nickname} seed={p.user_id} src={p.avatar_url} size="sm" />
                </ProfileLink>
                <ProfileLink userId={p.user_id} className="participant__name">
                  {p.nickname}
                </ProfileLink>
                <span className="participant__meta">
                  {demographicLabel(p.gender, p.age_band)}
                </span>
                {p.is_host && <span className="badge">{BUNGAE_COPY.hostBadge}</span>}
              </li>
            ))}
          </ul>
        )}

        {actionError && <p className="error-text">{actionError}</p>}
      </div>

      <BannerAd />

      {!canSeeInner ? (
        <>
          <div className="glass-panel bungae-restricted">
            <span className="circle-button" aria-hidden="true">
              <Icon name="lock-icon" />
            </span>
            <p>{BUNGAE_COPY.participantsRestricted}</p>
          </div>
          <div className="bottom-bar">{joinBar}</div>
        </>
      ) : (
        <div className="sheet bungae-chat-sheet">
          <CommentSection
            table="bungae_comments"
            parentColumn="bungae_id"
            targetId={bungae.id}
            reportType="bungae_comment"
            canWrite={!!profile}
            title={BUNGAE_COPY.chatTitle}
            placeholder={BUNGAE_COPY.chatPlaceholder}
          />
        </div>
      )}
    </section>
  )
}
