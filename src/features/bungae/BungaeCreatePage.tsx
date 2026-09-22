import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AppBar, Icon } from '../../components/ui'
import { BUNGAE_COPY } from '../../config/copy'
import { BUCHEON_PLACE_CHIPS, DEFAULT_SIDO, DEFAULT_SIGUNGU, SIDO_LIST } from '../../config/regions'
import { useAuth } from '../../lib/auth-context'
import { sigunguOptionsFor } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { defaultStartsAt } from './bungae-types'
import './BungaePage.css'

const MIN_CAPACITY = 2
const MAX_CAPACITY = 10

export function BungaeCreatePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [startsAt, setStartsAt] = useState(() => defaultStartsAt())
  const [sido, setSido] = useState<string>(profile?.sido || DEFAULT_SIDO)
  const [sigungu, setSigungu] = useState<string>(profile?.sigungu || DEFAULT_SIGUNGU)
  const [eupmyeondong, setEupmyeondong] = useState('')
  const [placeHint, setPlaceHint] = useState('')
  const [capacity, setCapacity] = useState(4)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!profile) return <Navigate to="/me" replace />

  const startsAtDate = startsAt ? new Date(startsAt) : null
  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !!startsAtDate &&
    startsAtDate.getTime() > Date.now() + 60 * 60 * 1000 &&
    !!sigungu &&
    eupmyeondong.trim().length > 0 &&
    capacity >= MIN_CAPACITY &&
    capacity <= MAX_CAPACITY &&
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
          sido,
          sigungu,
          eupmyeondong: eupmyeondong.trim() || null,
          place_hint: placeHint.trim() || null,
          capacity,
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      const { error: joinError } = await supabase.rpc('join_bungae', { p_bungae_id: data.id })
      if (joinError) throw joinError

      navigate(`/bungae/${data.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : BUNGAE_COPY.createError)
    } finally {
      setSubmitting(false)
    }
  }

  const clampCapacity = (n: number) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, n))

  return (
    <section className="bungae-create-page">
      <AppBar back title={BUNGAE_COPY.createTitle} />

      <div className="glass-panel create-form">
        <label className="field">
          <span className="field-label">{BUNGAE_COPY.titleLabel}</span>
          <input className="field-input" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">{BUNGAE_COPY.bodyLabel}</span>
          <textarea
            className="field-textarea"
            value={body}
            maxLength={500}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">{BUNGAE_COPY.startsAtLabel}</span>
          <div className="input-with-icon">
            <Icon name="clock-icon" />
            <input
              className="field-input"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <span className="field-hint">{BUNGAE_COPY.startsAtHint}</span>
        </label>

        <div className="onboarding-grid">
          <label className="field">
            <span className="field-label">{BUNGAE_COPY.sidoLabel}</span>
            <select
              className="field-select"
              value={sido}
              onChange={(e) => {
                setSido(e.target.value)
                setSigungu(sigunguOptionsFor(e.target.value)[0] ?? '')
              }}
            >
              {SIDO_LIST.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{BUNGAE_COPY.sigunguLabel}</span>
            <select className="field-select" value={sigungu} onChange={(e) => setSigungu(e.target.value)}>
              {sigunguOptionsFor(sido).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field-label">{BUNGAE_COPY.eupmyeondongLabel}</span>
          <input
            className="field-input"
            value={eupmyeondong}
            maxLength={20}
            placeholder="예: 역곡동"
            onChange={(e) => setEupmyeondong(e.target.value)}
          />
        </label>

        <div className="field">
          <label className="field">
            <span className="field-label">{BUNGAE_COPY.placeHintLabel}</span>
            <div className="input-with-icon">
              <Icon name="pin-icon" />
              <input
                className="field-input"
                value={placeHint}
                maxLength={30}
                placeholder="예: 부천역"
                onChange={(e) => setPlaceHint(e.target.value)}
              />
            </div>
          </label>
          {sigungu === '부천시' && (
            <div className="chip-row">
              {BUCHEON_PLACE_CHIPS.map((chip) => (
                <button
                  type="button"
                  key={chip}
                  className="chip"
                  aria-pressed={placeHint === chip}
                  onClick={() => setPlaceHint(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="bungae-capacity">
            {BUNGAE_COPY.capacityLabel}
          </label>
          <div className="stepper">
            <button
              type="button"
              className="circle-button circle-button--sm"
              aria-label="정원 줄이기"
              disabled={capacity <= MIN_CAPACITY}
              onClick={() => setCapacity((n) => clampCapacity(n - 1))}
            >
              <span aria-hidden="true">−</span>
            </button>
            <input
              id="bungae-capacity"
              className="stepper__value"
              type="number"
              inputMode="numeric"
              min={MIN_CAPACITY}
              max={MAX_CAPACITY}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              onBlur={() => setCapacity((n) => clampCapacity(n || MIN_CAPACITY))}
            />
            <button
              type="button"
              className="circle-button circle-button--sm"
              aria-label="정원 늘리기"
              disabled={capacity >= MAX_CAPACITY}
              onClick={() => setCapacity((n) => clampCapacity(n + 1))}
            >
              <Icon name="plus-icon" />
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
      </div>

      <p className="create-safety">{BUNGAE_COPY.safetyNotice}</p>

      <div className="bottom-bar">
        <button type="button" className="pill-button pill-button--block" disabled={!canSubmit} onClick={handleSubmit}>
          {BUNGAE_COPY.submit}
        </button>
      </div>
    </section>
  )
}
