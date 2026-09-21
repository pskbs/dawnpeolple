import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BUNGAE_COPY, CONCEPT_COPY, REGION_NOTICE } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { formatStartsAt, type Bungae } from './bungae-types'
import './BungaePage.css'

export function BungaeListPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
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

      const hostIds = [...new Set(list.map((b) => b.host_id))]
      if (hostIds.length > 0) {
        const { data: cards } = await supabase.from('profile_cards').select('id, nickname').in('id', hostIds)
        const map: Record<string, string> = {}
        for (const c of cards ?? []) map[c.id] = c.nickname
        setNicknames(map)
      }

      const slots = await Promise.all(
        list.map(async (b) => {
          const { data: n } = await supabase.rpc('get_bungae_remaining_slots', { p_bungae_id: b.id })
          return [b.id, (n as number) ?? 0] as const
        }),
      )
      setRemaining(Object.fromEntries(slots))
      setLoading(false)
    }
    load()
  }, [])

  function handleCreateClick() {
    navigate(profile ? '/bungae/new' : '/me')
  }

  return (
    <section className="bungae-page">
      <div className="bungae-header">
        <h1>{BUNGAE_COPY.listTitle}</h1>
        <button type="button" className="pill-button" onClick={handleCreateClick}>
          {BUNGAE_COPY.createButton}
        </button>
      </div>
      <p className="bungae-intro">{CONCEPT_COPY.bungaeIntro}</p>
      <p className="bungae-region-notice">{REGION_NOTICE}</p>

      {loading ? (
        <p>불러오는 중...</p>
      ) : bungaes.length === 0 ? (
        <p>{BUNGAE_COPY.empty}</p>
      ) : (
        <ul className="bungae-list">
          {bungaes.map((b) => (
            <li key={b.id}>
              <Link to={`/bungae/${b.id}`} className="bungae-card clay-card">
                <div className="bungae-card-header">
                  <h2>{b.title}</h2>
                  <span className="bungae-slots">{BUNGAE_COPY.remainingSlots(remaining[b.id] ?? 0)}</span>
                </div>
                <p className="bungae-card-body">{b.body}</p>
                <div className="bungae-card-footer">
                  <span>{formatStartsAt(b.starts_at)}</span>
                  {b.place_hint && <span>{b.place_hint}</span>}
                  <span>{nicknames[b.host_id] ?? '알 수 없음'}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
