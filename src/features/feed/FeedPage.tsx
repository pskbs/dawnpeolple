import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  COMMENT_COPY,
  CONCEPT_COPY,
  FEED_COMPOSER_PLACEHOLDER,
  FEED_NATIONWIDE_NOTICE,
  GUEST_COPY,
} from '../../config/copy'
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

type FeedComment = {
  id: number
  body: string
  author_id: string | null
  created_at: string
}

export function FeedPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set())
  const [openComments, setOpenComments] = useState<Set<number>>(new Set())
  const [commentsByPost, setCommentsByPost] = useState<Record<number, FeedComment[]>>({})
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({})

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
        setNicknames((prev) => ({ ...prev, ...map }))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!profile) {
      setLikedIds(new Set())
      return
    }
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', profile.id)
      .then(({ data }) => {
        setLikedIds(new Set((data ?? []).map((row) => row.post_id as number)))
      })
  }, [profile])

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

  async function toggleLike(postId: number) {
    if (!profile) {
      navigate('/me')
      return
    }
    const isLiked = likedIds.has(postId)
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (isLiked) next.delete(postId)
      else next.add(postId)
      return next
    })
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, like_count: p.like_count + (isLiked ? -1 : 1) } : p)),
    )
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('user_id', profile.id).eq('post_id', postId)
    } else {
      await supabase.from('post_likes').insert({ user_id: profile.id, post_id: postId })
    }
  }

  async function toggleComments(postId: number) {
    setOpenComments((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
    if (!commentsByPost[postId]) {
      const { data } = await supabase
        .from('comments')
        .select('id, body, author_id, created_at')
        .eq('post_id', postId)
        .eq('status', 'visible')
        .order('created_at', { ascending: true })
      const list = (data ?? []) as FeedComment[]
      setCommentsByPost((prev) => ({ ...prev, [postId]: list }))

      const authorIds = [...new Set(list.map((c) => c.author_id).filter((id): id is string => !!id))].filter(
        (id) => !nicknames[id],
      )
      if (authorIds.length > 0) {
        const { data: cards } = await supabase.from('profile_cards').select('id, nickname').in('id', authorIds)
        const map: Record<string, string> = {}
        for (const card of cards ?? []) map[card.id] = card.nickname
        setNicknames((prev) => ({ ...prev, ...map }))
      }
    }
  }

  async function submitComment(postId: number) {
    if (!profile) {
      navigate('/me')
      return
    }
    const draft = (commentDraft[postId] ?? '').trim()
    if (!draft) return
    const { data, error: insertError } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: profile.id, body: draft })
      .select('id, body, author_id, created_at')
      .single()
    if (insertError || !data) return

    setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), data as FeedComment] }))
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p)))
    setCommentDraft((prev) => ({ ...prev, [postId]: '' }))
    setNicknames((prev) => (prev[profile.id] ? prev : { ...prev, [profile.id]: profile.nickname }))
  }

  return (
    <section className="feed-page">
      <div className="feed-banner">
        <p>{CONCEPT_COPY.primary}</p>
      </div>
      <p className="feed-nationwide">{FEED_NATIONWIDE_NOTICE}</p>

      {profile ? (
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
            <button type="submit" className="pill-button" disabled={!body.trim() || submitting}>
              등록
            </button>
          </div>
          {error && <p className="feed-error">{error}</p>}
        </form>
      ) : (
        <div className="guest-cta clay-card">
          <p>{GUEST_COPY.browseNotice}</p>
          <button type="button" className="pill-button" onClick={() => navigate('/me')}>
            {GUEST_COPY.ctaLogin}
          </button>
        </div>
      )}

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
                <button
                  type="button"
                  className={`feed-action${likedIds.has(post.id) ? ' feed-action--active' : ''}`}
                  onClick={() => toggleLike(post.id)}
                >
                  좋아요 {post.like_count}
                </button>
                <button type="button" className="feed-action" onClick={() => toggleComments(post.id)}>
                  댓글 {post.comment_count}
                </button>
              </div>

              {openComments.has(post.id) && (
                <div className="feed-comments">
                  {(commentsByPost[post.id] ?? []).length === 0 ? (
                    <p className="feed-comments-empty">{COMMENT_COPY.empty}</p>
                  ) : (
                    <ul className="feed-comments-list">
                      {(commentsByPost[post.id] ?? []).map((c) => (
                        <li key={c.id}>
                          <span className="feed-comment-nickname">
                            {(c.author_id && nicknames[c.author_id]) || '알 수 없음'}
                          </span>
                          <span className="feed-comment-body">{c.body}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {profile ? (
                    <div className="feed-comment-form">
                      <input
                        className="pill-input"
                        placeholder={COMMENT_COPY.placeholder}
                        value={commentDraft[post.id] ?? ''}
                        maxLength={300}
                        onChange={(e) => setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitComment(post.id)
                        }}
                      />
                      <button type="button" className="pill-button-ghost" onClick={() => submitComment(post.id)}>
                        {COMMENT_COPY.submit}
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="pill-button-ghost" onClick={() => navigate('/me')}>
                      {GUEST_COPY.ctaLogin}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
