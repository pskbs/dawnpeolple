import { useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AttachmentTray } from '../../components/media'
import { Avatar, Icon } from '../../components/ui'
import { useGoBack } from '../../lib/use-go-back'
import { FEED_COPY } from '../../config/copy'
import { FEATURES } from '../../config/features'
import { useAuth } from '../../lib/auth-context'
import { MEDIA_LIMITS, removePublicMedia, uploadPublicMediaList, validateFile } from '../../lib/media'
import { supabase } from '../../lib/supabase'
import { showCompletionAd } from '../../platform'
import './FeedPage.css'

// 글자수 제한은 없어요(DB 기술 상한 20,000자만). 다른 사람에게는 500자 넘으면 "더 보기"로 접혀 보여요.
const TECHNICAL_MAX = 20000

export function ComposePage() {
  const { profile } = useAuth()
  const goBack = useGoBack('/feed')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!profile) return <Navigate to="/me" replace />

  function addFiles(list: FileList | null, input: HTMLInputElement | null) {
    if (!list) return
    setError(null)
    const picked = Array.from(list)
    const invalid = picked.map((f) => validateFile(f)).find(Boolean)
    const ok = picked.filter((f) => !validateFile(f))
    const merged = [...files, ...ok]
    if (merged.length > MEDIA_LIMITS.maxCount) setError(FEED_COPY.composeLimit(MEDIA_LIMITS.maxCount))
    else if (invalid) setError(invalid)
    setFiles(merged.slice(0, MEDIA_LIMITS.maxCount))
    if (input) input.value = ''
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile || (!body.trim() && files.length === 0)) return
    setError(null)
    setSubmitting(true)
    try {
      const media = await uploadPublicMediaList(profile.id, files)
      const { error: insertError } = await supabase.from('posts').insert({ author_id: profile.id, body: body.trim(), media })
      if (insertError) {
        await removePublicMedia(media)
        throw new Error(FEED_COPY.submitError)
      }
      showCompletionAd()
      // 글쓰기를 연 화면(수다방·프로필 등)으로 돌아가요.
      goBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : FEED_COPY.submitError)
      setSubmitting(false)
    }
  }

  const canSubmit = (body.trim().length > 0 || files.length > 0) && !submitting

  return (
    <form className="compose-page feed-composer" onSubmit={handleSubmit}>
      <header className="app-bar">
        <button type="button" className="compose-cancel" onClick={goBack}>
          {FEED_COPY.composeCancel}
        </button>
        <h1 className="app-bar__title">{FEED_COPY.composeTitle}</h1>
        <button type="submit" className="pill-button pill-button--sm" disabled={!canSubmit}>
          {submitting ? FEED_COPY.composeUploading : FEED_COPY.composeSubmit}
        </button>
      </header>

      <div className="sheet compose-sheet">
        <div className="compose-row">
          <div className="post__rail">
            <Avatar name={profile.nickname} seed={profile.id} src={profile.avatar_url} size="md" />
            <span className="post__line" />
          </div>
          <div className="compose-main">
            <span className="post__nickname">{profile.nickname}</span>
            <textarea
              placeholder={FEED_COPY.composePlaceholder}
              aria-label={FEED_COPY.composePlaceholder}
              value={body}
              maxLength={TECHNICAL_MAX}
              autoFocus
              rows={6}
              onChange={(e) => setBody(e.target.value)}
            />
            <AttachmentTray files={files} onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
            <div className="compose-tools">
              <button
                type="button"
                className="icon-button"
                aria-label={FEED_COPY.composeAddMedia}
                disabled={files.length >= MEDIA_LIMITS.maxCount}
                onClick={() => mediaRef.current?.click()}
              >
                <Icon name="image-icon" />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={FEED_COPY.composeAddFile}
                disabled={files.length >= MEDIA_LIMITS.maxCount}
                onClick={() => fileRef.current?.click()}
              >
                <Icon name="paperclip-icon" />
              </button>
              <input
                ref={mediaRef}
                type="file"
                accept={FEATURES.videoUpload ? 'image/*,video/*' : 'image/*'}
                multiple
                hidden
                data-testid="compose-media-input"
                onChange={(e) => addFiles(e.target.files, mediaRef.current)}
              />
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files, fileRef.current)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
    </form>
  )
}
