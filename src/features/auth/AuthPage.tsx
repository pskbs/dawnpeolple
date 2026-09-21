import { useState, type FormEvent } from 'react'
import { AUTH_COPY, CONCEPT_COPY } from '../../config/copy'
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
      <h1>{CONCEPT_COPY.tagline}</h1>
      <h2>{mode === 'login' ? AUTH_COPY.loginTitle : AUTH_COPY.signupTitle}</h2>

      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          {AUTH_COPY.emailLabel}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          {AUTH_COPY.passwordLabel}
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}

        <button type="submit" disabled={submitting}>
          {mode === 'login' ? AUTH_COPY.loginSubmit : AUTH_COPY.signupSubmit}
        </button>
      </form>

      <button
        type="button"
        className="auth-switch"
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
      >
        {mode === 'login' ? AUTH_COPY.switchToSignup : AUTH_COPY.switchToLogin}
      </button>
    </section>
  )
}
