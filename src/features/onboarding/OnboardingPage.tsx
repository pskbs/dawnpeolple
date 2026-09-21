import { useState } from 'react'
import { ONBOARDING_COPY } from '../../config/copy'
import { NICKNAME_ADJECTIVES, NICKNAME_NOUNS } from '../../config/nickname-words'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import './OnboardingPage.css'

const SIDO_OPTIONS = ['경기', '서울', '인천', '기타'] as const

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
      <h1>{ONBOARDING_COPY.title}</h1>

      <label>
        {ONBOARDING_COPY.nicknameLabel}
        <div className="nickname-row">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} />
          <button type="button" onClick={() => setNickname(generateNickname())}>
            {ONBOARDING_COPY.reroll}
          </button>
        </div>
      </label>

      <label>
        {ONBOARDING_COPY.genderLabel}
        <select value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}>
          <option value="female">여성</option>
          <option value="male">남성</option>
        </select>
      </label>

      <label>
        {ONBOARDING_COPY.birthYearLabel}
        <input
          type="number"
          inputMode="numeric"
          placeholder="1995"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value.slice(0, 4))}
        />
      </label>
      {birthYear.length === 4 && !isAdult && <p className="onboarding-warning">{ONBOARDING_COPY.under19Notice}</p>}

      <label>
        {ONBOARDING_COPY.sidoLabel}
        <select value={sido} onChange={(e) => setSido(e.target.value as (typeof SIDO_OPTIONS)[number])}>
          {SIDO_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label>
        {ONBOARDING_COPY.sigunguLabel}
        <input value={sigungu} onChange={(e) => setSigungu(e.target.value)} placeholder="부천시" />
      </label>

      <label>
        {ONBOARDING_COPY.workTypeLabel}
        <select value={workType} onChange={(e) => setWorkType(e.target.value)}>
          <option value="">선택 안 함</option>
          <option value="nursing">간호·의료</option>
          <option value="business">사장님·자영업</option>
          <option value="service">서비스·판매</option>
          <option value="manufacturing">제조·물류 교대</option>
          <option value="freelance">프리랜서·크리에이터</option>
          <option value="etc">기타</option>
        </select>
      </label>

      <label>
        {ONBOARDING_COPY.offTimeBandLabel}
        <select value={offTimeBand} onChange={(e) => setOffTimeBand(e.target.value)}>
          <option value="">선택 안 함</option>
          <option value="midnight">밤 12~3시</option>
          <option value="dawn">새벽 3~6시</option>
          <option value="morning">아침 6~9시</option>
          <option value="irregular">불규칙</option>
        </select>
      </label>

      <label className="checkbox-row">
        <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
        {ONBOARDING_COPY.agreeTerms}
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} />
        {ONBOARDING_COPY.agreePrivacy}
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={agree19} onChange={(e) => setAgree19(e.target.checked)} />
        {ONBOARDING_COPY.agree19}
      </label>

      {error && <p className="onboarding-warning">{error}</p>}

      <button type="button" disabled={!canSubmit} onClick={handleSubmit}>
        {ONBOARDING_COPY.submit}
      </button>
    </section>
  )
}
