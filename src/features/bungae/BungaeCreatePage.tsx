import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BUCHEON_PLACE_CHIPS, OPEN_REGIONS } from '../../config/regions'
import { BUNGAE_COPY, GUEST_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import './BungaePage.css'

export function BungaeCreatePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [placeHint, setPlaceHint] = useState('')
  const [capacity, setCapacity] = useState(4)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!profile) {
    return (
      <section className="guest-cta clay-card">
        <p>{GUEST_COPY.browseNotice}</p>
        <button type="button" className="pill-button" onClick={() => navigate('/me')}>
          {GUEST_COPY.ctaLogin}
        </button>
      </section>
    )
  }

  const startsAtDate = startsAt ? new Date(startsAt) : null
  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !!startsAtDate &&
    startsAtDate.getTime() > Date.now() + 60 * 60 * 1000 &&
    capacity >= 2 &&
    capacity <= 10 &&
    !submitting

  async function handleSubmit() {
    if (!profile || !startsAtDate) return
    setError(null)
    setSubmitting(true)
    try {
      const { data, error: insertError } = await supabase
        .from('bungaes')
        .insert({
          host_id: profile.id,
          title: title.trim(),
          body: body.trim(),
          starts_at: startsAtDate.toISOString(),
          region_code: OPEN_REGIONS[0],
          place_hint: placeHint.trim() || null,
          capacity,
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      const { error: joinError } = await supabase.rpc('join_bungae', { p_bungae_id: data.id })
      if (joinError) throw joinError

      navigate(`/bungae/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '소모임을 만들지 못했어요')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="bungae-create-page clay-card">
      <h1>{BUNGAE_COPY.createButton.replace('+ ', '')}</h1>

      <label>
        {BUNGAE_COPY.titleLabel}
        <input className="pill-input" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label>
        {BUNGAE_COPY.bodyLabel}
        <textarea value={body} maxLength={500} rows={4} onChange={(e) => setBody(e.target.value)} />
      </label>

      <label>
        {BUNGAE_COPY.startsAtLabel}
        <input
          className="pill-input"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
      </label>

      <label>
        {BUNGAE_COPY.placeHintLabel}
        <input
          className="pill-input"
          value={placeHint}
          maxLength={30}
          placeholder="예: 부천역"
          onChange={(e) => setPlaceHint(e.target.value)}
        />
      </label>
      <div className="bungae-chip-row">
        {BUCHEON_PLACE_CHIPS.map((chip) => (
          <button type="button" key={chip} className="bungae-chip" onClick={() => setPlaceHint(chip)}>
            {chip}
          </button>
        ))}
      </div>

      <label>
        {BUNGAE_COPY.capacityLabel}
        <input
          className="pill-input"
          type="number"
          min={2}
          max={10}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
      </label>

      {error && <p className="bungae-error">{error}</p>}

      <button type="button" className="pill-button" disabled={!canSubmit} onClick={handleSubmit}>
        {BUNGAE_COPY.submit}
      </button>
    </section>
  )
}
