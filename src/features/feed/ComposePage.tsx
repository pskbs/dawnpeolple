import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/ui'
import { FEED_COMPOSER_PLACEHOLDER, FEED_COPY, FEED_NATIONWIDE_NOTICE } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import './FeedPage.css'

const MAX_LENGTH = 500

export function ComposePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!profile) return <Navigate to="/me" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile || !body.trim()) return
    setError(null)
    setSubmitting(true)
    const { error: insertError } = await supabase.from('posts').insert({ author_id: profile.id, body: body.trim() })
    setSubmitting(false)
    if (insertError) {
      setError(insertError.message || FEED_COPY.submitError)
      return
    }
    navigate('/feed', { replace: true })
  }

  const remaining = MAX_LENGTH - body.length

  return (
    <form className="compose-page feed-composer" onSubmit={handleSubmit}>
      <header className="app-bar">
        <button type="button" className="compose-cancel" onClick={() => navigate(-1)}>
          {FEED_COPY.composeCancel}
        </button>
        <h1 className="app-bar__title">{FEED_COPY.composeTitle}</h1>
        <button type="submit" className="pill-button pill-button--sm" disabled={!body.trim() || submitting}>
          {FEED_COPY.composeSubmit}
        </button>
      </header>

      <div className="sheet compose-sheet">
        <div className="compose-row">
          <div className="post__rail">
            <Avatar name={profile.nickname} seed={profile.id} size="md" />
            <span className="post__line" />
          </div>
          <div className="compose-main">
            <span className="post__nickname">{profile.nickname}</span>
            <textarea
              placeholder={FEED_COMPOSER_PLACEHOLDER}
              value={body}
              maxLength={MAX_LENGTH}
              autoFocus
              rows={6}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
        <div className="compose-footer">
          <span className="muted">{FEED_NATIONWIDE_NOTICE}</span>
          <span className={`compose-counter${remaining < 50 ? ' compose-counter--warn' : ''}`}>{remaining}</span>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
    </form>
  )
}
