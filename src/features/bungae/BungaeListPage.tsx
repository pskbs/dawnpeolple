import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Icon, Loading } from '../../components/ui'
import { REGION_LABEL } from '../../config/brand'
import { BUNGAE_COPY, CONCEPT_COPY, REGION_NOTICE } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { fetchNicknames } from '../feed/feed-api'
import { dateTileParts, type Bungae } from './bungae-types'
import './BungaePage.css'

export function BungaeListPage() {
  const { profile } = useAuth()
  const [bungaes, setBungaes] = useState<Bungae[]>([])
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [remaining, setRemaining] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('bungaes')
        .select('id, host_id, title, body, starts_at, region_code, place_hint, capacity, status, created_at')
        .in('status', ['open', 'full'])
        .order('starts_at', { ascending: true })
        .limit(50)

      const list = (data ?? []) as Bungae[]
      setBungaes(list)

      const [names, slots] = await Promise.all([
        fetchNicknames(list.map((b) => b.host_id)),
        Promise.all(
          list.map(async (b) => {
            const { data: n } = await supabase.rpc('get_bungae_remaining_slots', { p_bungae_id: b.id })
            return [b.id, (n as number) ?? 0] as const
          }),
        ),
      ])
      setNicknames(names)
      setRemaining(Object.fromEntries(slots))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <section className="bungae-page">
      <header className="app-bar">
        <h1 className="bungae-page__title">{BUNGAE_COPY.listTitle}</h1>
        <span className="badge bungae-region-badge">
          <Icon name="pin-icon" />
          {REGION_LABEL}
        </span>
      </header>

      <div className="bungae-hero glass-panel">
        <div className="bungae-hero__text">
          <h2>{CONCEPT_COPY.bungaeIntro}</h2>
          <p>{REGION_NOTICE}</p>
        </div>
        <span className="orb orb--md bungae-hero__orb" aria-hidden="true" />
      </div>

      {loading ? (
        <Loading />
      ) : bungaes.length === 0 ? (
        <div className="empty-state glass-panel">
          <span className="orb orb--md" aria-hidden="true" />
          <p>{BUNGAE_COPY.empty}</p>
          <Link to={profile ? '/bungae/new' : '/me'} className="pill-button">
            {BUNGAE_COPY.createTitle}
          </Link>
        </div>
      ) : (
        <ul className="bungae-list">
          {bungaes.map((b) => {
            const left = remaining[b.id] ?? 0
            const joined = Math.max(0, b.capacity - left)
            const tile = dateTileParts(b.starts_at)
            const host = nicknames[b.host_id] ?? '알 수 없음'
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
                      <Avatar name={host} seed={b.host_id} size="xs" />
                      {host}
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
