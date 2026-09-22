import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DmButton } from '../../components/DmButton'
import { Avatar, Icon, Loading } from '../../components/ui'
import { REGION_LABEL } from '../../config/brand'
import { BUNGAE_COPY, CONCEPT_COPY, REGION_NOTICE } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { fetchProfileCards, UNKNOWN_NICKNAME, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { BUNGAE_COLUMNS, dateTileParts, storyDay, storyTime, type Bungae } from './bungae-types'
import './BungaePage.css'

export function BungaeListPage() {
  const { profile, blockedIds } = useAuth()
  const [bungaes, setBungaes] = useState<Bungae[]>([])
  const [cards, setCards] = useState<Record<string, ProfileCard>>({})
  const [remaining, setRemaining] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

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

  const visible = bungaes.filter((b) => !blockedIds.has(b.host_id))
  const upcoming = visible.slice(0, 12)

  return (
    <section className="bungae-page">
      <header className="app-bar">
        <h1 className="bungae-page__title">{BUNGAE_COPY.listTitle}</h1>
        <span className="badge bungae-region-badge">
          <Icon name="pin-icon" />
          {REGION_LABEL}
        </span>
        <DmButton />
      </header>

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

      <h2 className="bungae-section-title">{BUNGAE_COPY.allTitle}</h2>

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
                          {b.place_hint ?? REGION_LABEL}
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
