import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Icon, Loading } from '../../components/ui'
import { BUNGAE_COPY, CONCEPT_COPY, LOCATION_COPY, REGION_NOTICE } from '../../config/copy'
import { LocationSheet } from '../location/LocationSheet'
import { useAuth } from '../../lib/auth-context'
import { fetchProfileCards, regionRank, UNKNOWN_NICKNAME, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { BUNGAE_COLUMNS, dateTileParts, storyDay, storyTime, type Bungae } from './bungae-types'
import './BungaePage.css'

export function BungaeListPage() {
  const { profile, blockedIds } = useAuth()
  const [bungaes, setBungaes] = useState<Bungae[]>([])
  const [cards, setCards] = useState<Record<string, ProfileCard>>({})
  const [remaining, setRemaining] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)
  const [hideFull, setHideFull] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bungaes')
        .select(BUNGAE_COLUMNS)
        .in('status', ['open', 'full'])
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(50)

      const list = (data ?? []) as Bungae[]
      setBungaes(list)

      const [hostCards, slots] = await Promise.all([
        fetchProfileCards(list.map((b) => b.host_id)),
        Promise.all(
          list.map(async (b) => {
            const { data: n } = await supabase.rpc('get_bungae_remaining_slots', { p_bungae_id: b.id })
            return [b.id, (n as number) ?? 0] as const
          }),
        ),
      ])
      setCards(hostCards)
      setRemaining(Object.fromEntries(slots))
      setLoading(false)
    }
    load()
  }, [])

  const myLocation = useMemo(
    () => (profile?.sido && profile.sigungu ? { sido: profile.sido, sigungu: profile.sigungu } : null),
    [profile],
  )

  // 지역을 잠그지 않고 전국을 다 보여주되, 내 동네와 가까운 순으로 먼저 정렬해요(2026-09-22, docs/decisions.md).
  const sorted = useMemo(
    () =>
      [...bungaes].sort((a, b) => {
        const rankDiff = regionRank(a, myLocation) - regionRank(b, myLocation)
        if (rankDiff !== 0) return rankDiff
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      }),
    [bungaes, myLocation],
  )

  const visible = sorted.filter((b) => {
    if (blockedIds.has(b.host_id)) return false
    if (hideFull && (remaining[b.id] ?? 0) <= 0) return false
    return true
  })
  const upcoming = visible.slice(0, 12)

  const regionBadgeLabel = profile
    ? [profile.sido, profile.sigungu].filter(Boolean).join(' ') || LOCATION_COPY.unset
    : BUNGAE_COPY.regionBadgeGuest

  return (
    <section className="bungae-page">
      <header className="app-bar">
        <h1 className="bungae-page__title">{BUNGAE_COPY.listTitle}</h1>
        <button
          type="button"
          className="bungae-region-badge"
          aria-label={LOCATION_COPY.sheetTitle}
          onClick={() => (profile ? setLocationSheetOpen(true) : undefined)}
        >
          <Icon name="pin-icon" />
          {regionBadgeLabel}
        </button>
      </header>

      {profile && <LocationSheet open={locationSheetOpen} onClose={() => setLocationSheetOpen(false)} />}

      <div className="stories">
        <div className="stories__head">
          <h2>{BUNGAE_COPY.upcomingTitle}</h2>
        </div>
        <ul className="stories__list">
          <li>
            <Link to={profile ? '/bungae/new' : '/me'} className="story story--create">
              <span className="story__bubble">
                <Icon name="plus-icon" />
              </span>
              <span className="story__label">{BUNGAE_COPY.upcomingCreate}</span>
            </Link>
          </li>
          {upcoming.map((s) => (
            <li key={s.id}>
              <Link to={`/bungae/${s.id}`} className="story">
                <span className="avatar-ring">
                  <span className="story__bubble story__bubble--time">
                    <small>{storyDay(s.starts_at)}</small>
                    {storyTime(s.starts_at)}
                  </span>
                </span>
                <span className="story__label">{s.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="bungae-hero glass-panel">
        <div className="bungae-hero__text">
          <h2>{CONCEPT_COPY.bungaeIntro}</h2>
          <p>{REGION_NOTICE}</p>
        </div>
        <span className="orb orb--md bungae-hero__orb" aria-hidden="true" />
      </div>

      <div className="bungae-list-head">
        <h2 className="bungae-section-title">{BUNGAE_COPY.allTitle}</h2>
        <label className="toggle-row toggle-row--sm">
          {BUNGAE_COPY.hideFullToggle}
          <input type="checkbox" checked={hideFull} onChange={(e) => setHideFull(e.target.checked)} />
        </label>
      </div>

      {loading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <div className="empty-state glass-panel">
          <span className="orb orb--md" aria-hidden="true" />
          <p>{BUNGAE_COPY.empty}</p>
          <Link to={profile ? '/bungae/new' : '/me'} className="pill-button">
            {BUNGAE_COPY.createTitle}
          </Link>
        </div>
      ) : (
        <ul className="bungae-list">
          {visible.map((b) => {
            const left = remaining[b.id] ?? 0
            const joined = Math.max(0, b.capacity - left)
            const tile = dateTileParts(b.starts_at)
            const host = cards[b.host_id]
            const hostName = host?.nickname ?? UNKNOWN_NICKNAME
            return (
              <li key={b.id}>
                <Link to={`/bungae/${b.id}`} className="bungae-card glass-panel">
                  <div className="bungae-card__top">
                    <span className="date-tile">
                      <strong>{tile.day}</strong>
                      <small>{tile.weekday}</small>
                    </span>
                    <div className="bungae-card__heading">
                      <h2>{b.title}</h2>
                      <div className="bungae-meta">
                        <span>
                          <Icon name="clock-icon" />
                          {tile.time}
                        </span>
                        <span>
                          <Icon name="pin-icon" />
                          {b.place_hint ?? `${b.sigungu} ${b.eupmyeondong ?? ''}`.trim()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="bungae-card__body">{b.body}</p>

                  <div className="bungae-card__bottom">
                    <span className="bungae-host">
                      <Avatar name={hostName} seed={b.host_id} src={host?.avatar_url} size="xs" />
                      {hostName}
                    </span>
                    <span className={`bungae-slots${left <= 0 ? ' bungae-slots--full' : ''}`}>
                      {BUNGAE_COPY.remainingSlots(left)}
                    </span>
                  </div>
                  <div className="seat-bar" aria-hidden="true">
                    <span style={{ width: `${(joined / b.capacity) * 100}%` }} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
