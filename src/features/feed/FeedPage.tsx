import { useEffect, useState, type FormEvent } from 'react'
import { CONCEPT_COPY, FEED_COMPOSER_PLACEHOLDER, FEED_NATIONWIDE_NOTICE } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import './FeedPage.css'

type FeedPost = {
  id: number
  body: string
  like_count: number
  comment_count: number
  created_at: string
  author_id: string | null
}

export function FeedPage() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPosts() {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('posts')
      .select('id, body, like_count, comment_count, created_at, author_id')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!fetchError && data) {
      setPosts(data as FeedPost[])

      const authorIds = [...new Set(data.map((p) => p.author_id).filter((id): id is string => !!id))]
      if (authorIds.length > 0) {
        const { data: profileCards } = await supabase.from('profile_cards').select('id, nickname').in('id', authorIds)
        const map: Record<string, string> = {}
        for (const card of profileCards ?? []) {
          map[card.id] = card.nickname
        }
        setNicknames(map)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPosts()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    setSubmitting(true)
    try {
      const { error: insertError } = await supabase.from('posts').insert({
        author_id: profile.id,
        body: body.trim(),
      })
      if (insertError) throw insertError
      setBody('')
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : '글을 올리지 못했어요')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="feed-page">
      <div className="feed-banner">
        <p>{CONCEPT_COPY.primary}</p>
      </div>
      <p className="feed-nationwide">{FEED_NATIONWIDE_NOTICE}</p>

      <form onSubmit={handleSubmit} className="feed-composer">
        <textarea
          placeholder={FEED_COMPOSER_PLACEHOLDER}
          value={body}
          maxLength={500}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <div className="feed-composer-footer">
          <span>{body.length}/500</span>
          <button type="submit" disabled={!body.trim() || submitting}>
            등록
          </button>
        </div>
        {error && <p className="feed-error">{error}</p>}
      </form>

      {loading ? (
        <p>불러오는 중...</p>
      ) : posts.length === 0 ? (
        <p>아직 글이 없어요. 첫 글을 남겨볼까요?</p>
      ) : (
        <ul className="feed-list" data-testid="feed-list">
          {posts.map((post) => (
            <li key={post.id} className="feed-card" data-testid="feed-post">
              <div className="feed-card-header">
                <span className="feed-card-nickname">
                  {(post.author_id && nicknames[post.author_id]) || '알 수 없음'}
                </span>
              </div>
              <p className="feed-card-body">{post.body}</p>
              <div className="feed-card-footer">
                <span>좋아요 {post.like_count}</span>
                <span>댓글 {post.comment_count}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
