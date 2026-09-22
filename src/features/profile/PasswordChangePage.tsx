import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useToast } from '../../components/toast'
import { AppBar } from '../../components/ui'
import { PASSWORD_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { useGoBack } from '../../lib/use-go-back'
import './ProfilePage.css'

// 내정보 → 설정 → 비밀번호 변경. 메일로 받은 임시 비밀번호를 여기서 바꿔요.
export function PasswordChangePage() {
  const { session } = useAuth()
  const toast = useToast()
  const goBack = useGoBack('/me/settings')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const email = session?.user.email
  if (!session || !email) return <Navigate to="/me" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next !== confirm) return setError(PASSWORD_COPY.mismatch)
    if (next === current) return setError(PASSWORD_COPY.same)
    setSaving(true)
    try {
      // 지금 비밀번호가 맞는지 먼저 확인해요(기기를 잠깐 빌린 사람이 바꾸지 못하게).
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: email!, password: current })
      if (verifyError) throw new Error(PASSWORD_COPY.wrongCurrent)
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) throw new Error(PASSWORD_COPY.error)
      toast.show(PASSWORD_COPY.done)
      goBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : PASSWORD_COPY.error)
      setSaving(false)
    }
  }

  return (
    <section className="profile-edit-page">
      <AppBar back="/me/settings" title={PASSWORD_COPY.title} />

      <form className="glass-panel edit-form" onSubmit={handleSubmit}>
        <p className="muted">{PASSWORD_COPY.hint}</p>
        <label className="field">
          <span className="field-label">{PASSWORD_COPY.current}</span>
          <input
            className="field-input"
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">{PASSWORD_COPY.next}</span>
          <input
            className="field-input"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">{PASSWORD_COPY.confirm}</span>
          <input
            className="field-input"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="pill-button pill-button--block" disabled={saving}>
          {PASSWORD_COPY.submit}
        </button>
      </form>
    </section>
  )
}
