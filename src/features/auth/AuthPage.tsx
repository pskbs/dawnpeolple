import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/ui'
import { BRAND_NAME } from '../../config/brand'
import { AUTH_COPY, AUTH_ERROR_COPY, AUTH_EXTRA_COPY, CONCEPT_COPY } from '../../config/copy'
import { supabase } from '../../lib/supabase'
import { ResetPasswordSheet } from './ResetPasswordSheet'
import './AuthPage.css'

// 마지막으로 로그인한 이메일을 기억해 다음에 채워줘요(비밀번호는 저장하지 않아요).
const LAST_EMAIL_KEY = 'dawnpeople:last-email'

function readLastEmail() {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveLastEmail(email: string) {
  try {
    localStorage.setItem(LAST_EMAIL_KEY, email)
  } catch {
    // 저장이 막힌 환경(시크릿 모드 등)에서는 그냥 넘어가요.
  }
}

// Supabase 원문(영어) 에러를 해요체 안내로 바꿔요. code 우선, 없으면 메시지로 판별.
function authErrorMessage(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : ''
  const message = err instanceof Error ? err.message.toLowerCase() : ''
  if (code === 'over_email_send_rate_limit' || message.includes('email rate limit')) return AUTH_ERROR_COPY.emailRateLimit
  if (code === 'over_request_rate_limit' || message.includes('rate limit')) return AUTH_ERROR_COPY.requestRateLimit
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered'))
    return AUTH_ERROR_COPY.alreadyRegistered
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return AUTH_ERROR_COPY.invalidCredentials
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return AUTH_ERROR_COPY.emailNotConfirmed
  if (code === 'weak_password' || message.includes('password should')) return AUTH_ERROR_COPY.weakPassword
  if (code === 'email_address_invalid' || (message.includes('email address') && message.includes('invalid')))
    return AUTH_ERROR_COPY.invalidEmail
  return AUTH_ERROR_COPY.unknown
}

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState(readLastEmail)
  const [resetOpen, setResetOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function switchMode(next: 'login' | 'signup') {
    setMode(next)
    setError(null)
    setNotice(null)
    if (next === 'signup') setPassword('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        saveLastEmail(email.trim())
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        saveLastEmail(email.trim())
        setNotice(AUTH_COPY.signupSuccess)
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-backdrop" aria-hidden="true">
        <span className="orb auth-backdrop__orb auth-backdrop__orb--a" />
        <span className="orb auth-backdrop__orb auth-backdrop__orb--b" />
      </div>

      <div className="auth-card glass-panel">
        <div className="app-icon" aria-hidden="true">
          <Icon name="moon-icon" className="app-icon__moon" />
          <Icon name="sparkle-icon" className="app-icon__sparkle" />
        </div>

        <h2>{mode === 'login' ? AUTH_COPY.loginTitle : AUTH_COPY.signupTitle}</h2>
        <p className="auth-sub">
          {BRAND_NAME} · {AUTH_EXTRA_COPY.subtitle}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-with-icon">
            <Icon name="mail-icon" />
            <input
              className="field-input"
              type="email"
              required
              aria-label={AUTH_COPY.emailLabel}
              placeholder={AUTH_EXTRA_COPY.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="input-with-icon">
            <Icon name="lock-icon" />
            <input
              className="field-input"
              type="password"
              required
              minLength={6}
              aria-label={AUTH_COPY.passwordLabel}
              placeholder={AUTH_EXTRA_COPY.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'signup' && <p className="auth-hint">{AUTH_COPY.signupHint}</p>}
          {error && <p className="error-text">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          <button type="submit" className="pill-button pill-button--block" disabled={submitting}>
            {mode === 'login' ? AUTH_COPY.loginSubmit : AUTH_COPY.signupSubmit}
          </button>
        </form>

        {mode === 'login' ? (
          <>
            <p className="auth-keep">{AUTH_COPY.keepLoggedIn}</p>
            <button type="button" className="auth-switch" onClick={() => setResetOpen(true)}>
              {AUTH_COPY.forgot}
            </button>
          </>
        ) : (
          <button type="button" className="auth-switch auth-switch--strong" onClick={() => switchMode('login')}>
            {AUTH_COPY.switchToLogin}
          </button>
        )}
      </div>

      {mode === 'login' && (
        <div className="auth-signup-cta glass-panel">
          <div className="auth-signup-cta__text">
            <strong>{AUTH_COPY.signupPromptTitle}</strong>
            <span>{AUTH_COPY.signupPromptDesc}</span>
          </div>
          <button type="button" className="pill-button auth-signup-cta__button" onClick={() => switchMode('signup')}>
            {AUTH_COPY.signupPromptButton}
          </button>
        </div>
      )}

      {resetOpen && <ResetPasswordSheet open onClose={() => setResetOpen(false)} initialEmail={email} />}

      <p className="auth-tagline">{CONCEPT_COPY.tagline}</p>
    </section>
  )
}
