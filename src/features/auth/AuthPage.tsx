import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/ui'
import { BRAND_NAME } from '../../config/brand'
import { AUTH_COPY, AUTH_EXTRA_COPY, CONCEPT_COPY } from '../../config/copy'
import { supabase } from '../../lib/supabase'
import './AuthPage.css'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        setNotice(AUTH_COPY.signupSuccess)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 발생했어요')
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

          {mode === 'signup' && <p className="auth-hint">가입 다음 화면에서 닉네임·성별·연령대를 설정해요.</p>}
          {error && <p className="error-text">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          <button type="submit" className="pill-button pill-button--block" disabled={submitting}>
            {mode === 'login' ? AUTH_COPY.loginSubmit : AUTH_COPY.signupSubmit}
          </button>
        </form>

        <button type="button" className="auth-switch" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? AUTH_COPY.switchToSignup : AUTH_COPY.switchToLogin}
        </button>
      </div>

      <p className="auth-tagline">{CONCEPT_COPY.tagline}</p>
    </section>
  )
}
