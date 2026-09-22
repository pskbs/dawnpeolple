import { useState, type FormEvent } from 'react'
import { BottomSheet, Icon } from '../../components/ui'
import { AUTH_EXTRA_COPY, RESET_COPY } from '../../config/copy'

// 아이디(=가입 이메일) 안내 + 새 비밀번호 메일 발송(api/auth/reset-password.ts)
export function ResetPasswordSheet({
  open,
  onClose,
  initialEmail,
}: {
  open: boolean
  onClose: () => void
  initialEmail: string
}) {
  const [email, setEmail] = useState(initialEmail)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    if (sending) return
    setDone(false)
    setError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 429) throw new Error(RESET_COPY.tooMany)
      if (!res.ok) throw new Error(RESET_COPY.error)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : RESET_COPY.error)
    } finally {
      setSending(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title={RESET_COPY.title}>
      {done ? (
        <div className="reset-sheet">
          <p className="reset-sheet__done">{RESET_COPY.done}</p>
          <p className="reset-sheet__warn">{RESET_COPY.afterLogin}</p>
          <button type="button" className="pill-button pill-button--block" onClick={close}>
            {RESET_COPY.close}
          </button>
        </div>
      ) : (
        <form className="reset-sheet" onSubmit={handleSubmit}>
          <p className="reset-sheet__info">{RESET_COPY.idInfo}</p>
          <p className="bottom-sheet__desc">{RESET_COPY.desc}</p>
          <div className="input-with-icon">
            <Icon name="mail-icon" />
            <input
              className="field-input"
              type="email"
              required
              aria-label={AUTH_EXTRA_COPY.emailPlaceholder}
              placeholder={AUTH_EXTRA_COPY.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="pill-button pill-button--block" disabled={sending || !email}>
            {sending ? RESET_COPY.sending : RESET_COPY.submit}
          </button>
        </form>
      )}
    </BottomSheet>
  )
}
