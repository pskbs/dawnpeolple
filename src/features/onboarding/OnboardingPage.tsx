import { useState } from 'react'
import { Icon } from '../../components/ui'
import { ONBOARDING_COPY } from '../../config/copy'
import { NICKNAME_ADJECTIVES, NICKNAME_NOUNS } from '../../config/nickname-words'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import './OnboardingPage.css'

const SIDO_OPTIONS = ['경기', '서울', '인천', '기타'] as const

const WORK_TYPE_OPTIONS = [
  ['nursing', '간호·의료'],
  ['business', '사장님·자영업'],
  ['service', '서비스·판매'],
  ['manufacturing', '제조·물류 교대'],
  ['freelance', '프리랜서·크리에이터'],
  ['etc', '기타'],
] as const

const OFF_TIME_OPTIONS = [
  ['midnight', '밤 12~3시'],
  ['dawn', '새벽 3~6시'],
  ['morning', '아침 6~9시'],
  ['irregular', '불규칙'],
] as const

function generateNickname() {
  const adj = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)]
  const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)]
  return `${adj} ${noun}`
}

export function OnboardingPage() {
  const { refreshProfile } = useAuth()
  const [nickname, setNickname] = useState(generateNickname)
  const [gender, setGender] = useState<'male' | 'female'>('female')
  const [birthYear, setBirthYear] = useState('')
  const [sido, setSido] = useState<(typeof SIDO_OPTIONS)[number]>('경기')
  const [sigungu, setSigungu] = useState('부천시')
  const [workType, setWorkType] = useState('')
  const [offTimeBand, setOffTimeBand] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agree19, setAgree19] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const currentYear = new Date().getFullYear()
  const birthYearNum = Number(birthYear)
  const isAdult = birthYear.length === 4 && currentYear - birthYearNum >= 19
  const canSubmit =
    nickname.trim().length >= 2 &&
    birthYear.length === 4 &&
    isAdult &&
    agreeTerms &&
    agreePrivacy &&
    agree19 &&
    !submitting

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const { error: rpcError } = await supabase.rpc('complete_onboarding', {
        p_nickname: nickname.trim(),
        p_gender: gender,
        p_birth_year: birthYearNum,
        p_sido: sido,
        p_sigungu: sigungu,
        p_work_type: workType || null,
        p_off_time_band: offTimeBand || null,
        p_terms_version: 'draft-1',
        p_privacy_version: 'draft-1',
      })
      if (rpcError) throw rpcError
      await refreshProfile()
    } catch (err) {
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
              onChange={(e) => setSido(e.target.value as (typeof SIDO_OPTIONS)[number])}
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
            <input
              id="ob-sigungu"
              className="field-input"
              value={sigungu}
              onChange={(e) => setSigungu(e.target.value)}
              placeholder="부천시"
            />
          </div>
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
        <label className="check-row">
          <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
          {ONBOARDING_COPY.agreeTerms}
        </label>
        <label className="check-row">
          <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} />
          {ONBOARDING_COPY.agreePrivacy}
        </label>
        <label className="check-row">
          <input type="checkbox" checked={agree19} onChange={(e) => setAgree19(e.target.checked)} />
          {ONBOARDING_COPY.agree19}
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button type="button" className="pill-button pill-button--block" disabled={!canSubmit} onClick={handleSubmit}>
        {ONBOARDING_COPY.submit}
      </button>
    </section>
  )
}
