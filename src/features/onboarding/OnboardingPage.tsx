import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, FullModal, Icon } from '../../components/ui'
import { ONBOARDING_COPY } from '../../config/copy'
import { PRIVACY, PRIVACY_VERSION, TERMS, TERMS_VERSION } from '../../config/legal'
import { NICKNAME_ADJECTIVES, NICKNAME_NOUNS } from '../../config/nickname-words'
import { useAuth } from '../../lib/auth-context'
import { removePublicMedia, uploadPublicMedia, validateFile } from '../../lib/media'
import {
  BIO_MAX,
  LOCATION_LABEL_PRESETS,
  OFF_TIME_OPTIONS,
  SIDO_OPTIONS,
  sigunguOptionsFor,
  WORK_TYPE_OPTIONS,
} from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { LegalDocView } from '../legal/LegalPage'
import './OnboardingPage.css'

function generateNickname() {
  const adj = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)]
  const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)]
  return `${adj} ${noun}`
}

export function OnboardingPage() {
  const { session, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState(generateNickname)
  const [bio, setBio] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [gender, setGender] = useState<'male' | 'female'>('female')
  const [birthYear, setBirthYear] = useState('')
  const [sido, setSido] = useState<(typeof SIDO_OPTIONS)[number]>('경기')
  const [sigungu, setSigungu] = useState('부천시')
  const [locationLabel, setLocationLabel] = useState('')
  const [workType, setWorkType] = useState('')
  const [offTimeBand, setOffTimeBand] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agree19, setAgree19] = useState(false)
  const [legalOpen, setLegalOpen] = useState<'terms' | 'privacy' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl])

  const currentYear = new Date().getFullYear()
  const birthYearNum = Number(birthYear)
  const isAdult = birthYear.length === 4 && currentYear - birthYearNum >= 19
  const allAgreed = agreeTerms && agreePrivacy && agree19
  const canSubmit = nickname.trim().length >= 2 && birthYear.length === 4 && isAdult && allAgreed && !submitting

  function toggleAll(checked: boolean) {
    setAgreeTerms(checked)
    setAgreePrivacy(checked)
    setAgree19(checked)
  }

  function pickPhoto(list: FileList | null) {
    const file = list?.[0]
    if (photoRef.current) photoRef.current.value = ''
    if (!file) return
    const invalid = validateFile(file)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setPhoto(file)
  }

  async function handleSubmit() {
    const userId = session?.user.id
    if (!userId) return
    setError(null)
    setSubmitting(true)
    let avatarUrl: string | null = null
    try {
      if (photo) avatarUrl = (await uploadPublicMedia(userId, photo)).url ?? null
      const { error: rpcError } = await supabase.rpc('complete_onboarding', {
        p_nickname: nickname.trim(),
        p_gender: gender,
        p_birth_year: birthYearNum,
        p_sido: sido,
        p_sigungu: sigungu,
        p_work_type: workType || null,
        p_off_time_band: offTimeBand || null,
        p_terms_version: TERMS_VERSION,
        p_privacy_version: PRIVACY_VERSION,
        p_avatar_url: avatarUrl,
        p_bio: bio.trim() || null,
        p_location_label: locationLabel.trim() || null,
      })
      if (rpcError) throw rpcError
      await refreshProfile()
    } catch (err) {
      if (avatarUrl) void removePublicMedia([avatarUrl])
      setError(err instanceof Error ? err.message : '문제가 발생했어요')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="onboarding-page">
      <div className="onboarding-hero">
        <span className="orb orb--md" aria-hidden="true" />
        <h1>{ONBOARDING_COPY.title}</h1>
      </div>

      <div className="glass-panel onboarding-card">
        <div className="field onboarding-photo">
          <span className="field-label">{ONBOARDING_COPY.photoLabel}</span>
          <div className="onboarding-photo__row">
            <button
              type="button"
              className="onboarding-photo__avatar"
              aria-label={ONBOARDING_COPY.photoPick}
              onClick={() => photoRef.current?.click()}
            >
              <Avatar name={nickname || '새'} seed={session?.user.id} src={photoUrl} size="xl" />
              <span className="onboarding-photo__badge" aria-hidden="true">
                <Icon name="camera-icon" />
              </span>
            </button>
            <div className="onboarding-photo__side">
              <p className="field-hint">{ONBOARDING_COPY.photoHint}</p>
              <div className="chip-row">
                <button type="button" className="chip" onClick={() => photoRef.current?.click()}>
                  {ONBOARDING_COPY.photoPick}
                </button>
                {photo && (
                  <button type="button" className="chip" onClick={() => setPhoto(null)}>
                    {ONBOARDING_COPY.photoReset}
                  </button>
                )}
              </div>
            </div>
          </div>
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files)} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="ob-nickname">
            {ONBOARDING_COPY.nicknameLabel}
          </label>
          <div className="nickname-row">
            <input
              id="ob-nickname"
              className="field-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
            />
            <button
              type="button"
              className="circle-button"
              aria-label={ONBOARDING_COPY.reroll}
              onClick={() => setNickname(generateNickname())}
            >
              <Icon name="refresh-icon" />
            </button>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="ob-bio">
            {ONBOARDING_COPY.bioLabel}
          </label>
          <input
            id="ob-bio"
            className="field-input"
            value={bio}
            maxLength={BIO_MAX}
            placeholder={ONBOARDING_COPY.bioPlaceholder}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">{ONBOARDING_COPY.genderLabel}</span>
          <div className="segmented" role="group" aria-label={ONBOARDING_COPY.genderLabel}>
            <button type="button" aria-pressed={gender === 'female'} onClick={() => setGender('female')}>
              여성
            </button>
            <button type="button" aria-pressed={gender === 'male'} onClick={() => setGender('male')}>
              남성
            </button>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="ob-birth">
            {ONBOARDING_COPY.birthYearLabel}
          </label>
          <input
            id="ob-birth"
            className="field-input"
            type="number"
            inputMode="numeric"
            placeholder="1995"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.slice(0, 4))}
          />
          {birthYear.length === 4 && !isAdult && <p className="error-text">{ONBOARDING_COPY.under19Notice}</p>}
          <p className="field-hint">{ONBOARDING_COPY.privacyNote}</p>
        </div>

        <div className="onboarding-grid">
          <div className="field">
            <label className="field-label" htmlFor="ob-sido">
              {ONBOARDING_COPY.sidoLabel}
            </label>
            <select
              id="ob-sido"
              className="field-select"
              value={sido}
              onChange={(e) => {
                const next = e.target.value as (typeof SIDO_OPTIONS)[number]
                setSido(next)
                setSigungu(sigunguOptionsFor(next)[0] ?? '')
              }}
            >
              {SIDO_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ob-sigungu">
              {ONBOARDING_COPY.sigunguLabel}
            </label>
            <select id="ob-sigungu" className="field-select" value={sigungu} onChange={(e) => setSigungu(e.target.value)}>
              {sigunguOptionsFor(sido).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="ob-location-label">
            {ONBOARDING_COPY.locationLabelLabel}
          </label>
          <div className="chip-row">
            {LOCATION_LABEL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="chip"
                aria-pressed={locationLabel === preset}
                onClick={() => setLocationLabel(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            id="ob-location-label"
            className="field-input"
            value={locationLabel}
            maxLength={10}
            placeholder="예: 집"
            onChange={(e) => setLocationLabel(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">{ONBOARDING_COPY.workTypeLabel}</span>
          <div className="chip-row">
            {WORK_TYPE_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={workType === value}
                onClick={() => setWorkType(workType === value ? '' : value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">{ONBOARDING_COPY.offTimeBandLabel}</span>
          <div className="chip-row">
            {OFF_TIME_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={offTimeBand === value}
                onClick={() => setOffTimeBand(offTimeBand === value ? '' : value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel onboarding-agree">
        <label className="check-row check-row--all">
          <input type="checkbox" checked={allAgreed} onChange={(e) => toggleAll(e.target.checked)} />
          {ONBOARDING_COPY.agreeAll}
        </label>
        <div className="agree-row">
          <label className="check-row">
            <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
            {ONBOARDING_COPY.agreeTerms}
          </label>
          <button
            type="button"
            className="agree-row__view"
            aria-label={ONBOARDING_COPY.viewTerms}
            onClick={() => setLegalOpen('terms')}
          >
            <Icon name="chevron-right-icon" />
          </button>
        </div>
        <div className="agree-row">
          <label className="check-row">
            <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} />
            {ONBOARDING_COPY.agreePrivacy}
          </label>
          <button
            type="button"
            className="agree-row__view"
            aria-label={ONBOARDING_COPY.viewPrivacy}
            onClick={() => setLegalOpen('privacy')}
          >
            <Icon name="chevron-right-icon" />
          </button>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={agree19} onChange={(e) => setAgree19(e.target.checked)} />
          {ONBOARDING_COPY.agree19}
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button type="button" className="pill-button pill-button--block" disabled={!canSubmit} onClick={handleSubmit}>
        {ONBOARDING_COPY.submit}
      </button>

      <FullModal open={legalOpen === 'terms'} onClose={() => setLegalOpen(null)} title={TERMS.title}>
        <LegalDocView doc={TERMS} />
      </FullModal>
      <FullModal open={legalOpen === 'privacy'} onClose={() => setLegalOpen(null)} title={PRIVACY.title}>
        <LegalDocView doc={PRIVACY} />
      </FullModal>
    </section>
  )
}
