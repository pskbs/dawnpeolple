import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BannerAd } from '../../components/BannerAd'
import { AppBar, Loading } from '../../components/ui'
import { useGoBack } from '../../lib/use-go-back'
import { COMMENT_COPY, FEED_COPY, GUEST_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { fetchProfileCard, UNKNOWN_NICKNAME, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { CommentSection } from '../comments/CommentSection'
import { normalizePosts, POST_COLUMNS, useLikedPosts, type FeedPost } from './feed-api'
import { PostItem } from './PostItem'
import './FeedPage.css'

export function PostDetailPage() {
  const { id } = useParams()
  const { profile, blockedIds } = useAuth()
  const navigate = useNavigate()
  const goBack = useGoBack('/feed')
  const [post, setPost] = useState<FeedPost | null>(null)
  const [author, setAuthor] = useState<ProfileCard | undefined>()
  const [loading, setLoading] = useState(true)
  const { likedIds, toggle } = useLikedPosts(profile?.id)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('posts')
        .select(POST_COLUMNS)
        .eq('id', Number(id))
        .eq('status', 'visible')
        .maybeSingle()
      const row = data ? normalizePosts([data])[0] : null
      setPost(row)
      if (row?.author_id) setAuthor((await fetchProfileCard(row.author_id)) ?? undefined)
      setLoading(false)
    }
    load()
  }, [id])

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

  const hidden = !!post?.author_id && blockedIds.has(post.author_id)

  return (
    <section className="thread-page">
      <AppBar back="/feed" title={FEED_COPY.threadTitle} />

      {loading ? (
        <Loading />
      ) : !post || hidden ? (
        <div className="empty-state">
          <span className="orb orb--md" aria-hidden="true" />
          <p>{FEED_COPY.notFound}</p>
        </div>
      ) : (
        <div className="sheet thread-sheet">
          <PostItem
            post={post}
            author={author}
            liked={likedIds.has(post.id)}
            onLike={handleLike}
            onDeleted={goBack}
            variant="detail"
          />
          <BannerAd />
          <CommentSection
            table="comments"
            parentColumn="post_id"
            targetId={post.id}
            reportType="comment"
            canWrite={!!profile}
            placeholder={COMMENT_COPY.placeholderFor(author?.nickname ?? UNKNOWN_NICKNAME)}
            title={COMMENT_COPY.title}
            onCountChange={(delta) => setPost((p) => (p ? { ...p, comment_count: p.comment_count + delta } : p))}
            writeBlocked={
              <button type="button" className="pill-button pill-button--block" onClick={() => navigate('/me')}>
                {GUEST_COPY.ctaLogin}
              </button>
            }
          />
        </div>
      )}
    </section>
  )
}
