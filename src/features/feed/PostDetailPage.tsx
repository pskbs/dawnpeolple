import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar, Avatar, Icon, Loading } from '../../components/ui'
import { COMMENT_COPY, FEED_COPY, GUEST_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { formatRelativeTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import {
  COMMENT_COLUMNS,
  fetchNicknames,
  POST_COLUMNS,
  useLikedPosts,
  type FeedComment,
  type FeedPost,
} from './feed-api'
import { PostItem } from './PostItem'
import './FeedPage.css'

export function PostDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const { likedIds, toggle } = useLikedPosts(profile?.id)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const postId = Number(id)
      const [{ data: postRow }, { data: commentRows }] = await Promise.all([
        supabase.from('posts').select(POST_COLUMNS).eq('id', postId).eq('status', 'visible').maybeSingle(),
        supabase
          .from('comments')
          .select(COMMENT_COLUMNS)
          .eq('post_id', postId)
          .eq('status', 'visible')
          .order('created_at', { ascending: true }),
      ])
      const list = (commentRows ?? []) as FeedComment[]
      setPost(postRow as FeedPost | null)
      setComments(list)
      setNicknames(await fetchNicknames([postRow?.author_id ?? null, ...list.map((c) => c.author_id)]))
      setLoading(false)
    }
    load()
  }, [id])

  const nick = (authorId: string | null) => (authorId && nicknames[authorId]) || '알 수 없음'

  async function handleLike() {
    if (!post) return
    if (!profile) {
      navigate('/me')
      return
    }
    const nowLiked = !likedIds.has(post.id)
    setPost({ ...post, like_count: post.like_count + (nowLiked ? 1 : -1) })
    await toggle(post.id)
  }

  async function submitComment() {
    if (!profile || !post) return
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, author_id: profile.id, body: text })
      .select(COMMENT_COLUMNS)
      .single()
    setSending(false)
    if (error || !data) return
    setComments((prev) => [...prev, data as FeedComment])
    setPost({ ...post, comment_count: post.comment_count + 1 })
    setNicknames((prev) => ({ ...prev, [profile.id]: profile.nickname }))
    setDraft('')
  }

  return (
    <section className="thread-page">
      <AppBar back="/feed" title={FEED_COPY.threadTitle} />

      {loading ? (
        <Loading />
      ) : !post ? (
        <div className="empty-state">
          <span className="orb orb--md" aria-hidden="true" />
          <p>{FEED_COPY.notFound}</p>
        </div>
      ) : (
        <div className="sheet thread-sheet">
          <PostItem
            post={post}
            nickname={nick(post.author_id)}
            liked={likedIds.has(post.id)}
            onLike={handleLike}
            variant="detail"
          />

          <div className="thread-divider">
            <span>{FEED_COPY.repliesTitle}</span>
            <span className="muted">{comments.length}</span>
          </div>

          {comments.length === 0 ? (
            <p className="thread-empty">{COMMENT_COPY.empty}</p>
          ) : (
            <ul className="reply-list">
              {comments.map((c) => (
                <li key={c.id} className="reply">
                  <Avatar name={nick(c.author_id)} seed={c.author_id} size="sm" />
                  <div className="reply__main">
                    <div className="post__header">
                      <span className="post__nickname">{nick(c.author_id)}</span>
                      <span className="post__time">{formatRelativeTime(c.created_at)}</span>
                    </div>
                    <p className="reply__body">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {post && (
        <div className="bottom-bar">
          {profile ? (
            <form
              className="composer-bar feed-comment-form"
              onSubmit={(e) => {
                e.preventDefault()
                submitComment()
              }}
            >
              <Avatar name={profile.nickname} seed={profile.id} size="sm" />
              <input
                placeholder={FEED_COPY.replyPlaceholder(nick(post.author_id))}
                aria-label={COMMENT_COPY.placeholder}
                value={draft}
                maxLength={300}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button
                type="submit"
                className="circle-button circle-button--primary circle-button--sm"
                disabled={!draft.trim() || sending}
                aria-label={COMMENT_COPY.submit}
              >
                <Icon name="arrow-up-icon" />
              </button>
            </form>
          ) : (
            <button type="button" className="pill-button pill-button--block" onClick={() => navigate('/me')}>
              {GUEST_COPY.ctaLogin}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
