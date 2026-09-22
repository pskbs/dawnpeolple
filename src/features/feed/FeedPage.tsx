import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DmButton } from '../../components/DmButton'
import { Loading } from '../../components/ui'
import { BRAND_NAME } from '../../config/brand'
import { FEED_COPY, FEED_NATIONWIDE_NOTICE, GUEST_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { fetchProfileCards, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { normalizePosts, POST_COLUMNS, useLikedPosts, type FeedPost } from './feed-api'
import { PostItem } from './PostItem'
import './FeedPage.css'

const PAGE_SIZE = 20

// 수다방: 새벽에 일하는 사람들의 스레드형 SNS 피드. 글쓰기는 탭바의 + 버튼으로만 해요.
export function FeedPage() {
  const { profile, blockedIds } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [cards, setCards] = useState<Record<string, ProfileCard>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { likedIds, toggle } = useLikedPosts(profile?.id)

  const loadPage = useCallback(async (before?: string) => {
    let query = supabase
      .from('posts')
      .select(POST_COLUMNS)
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (before) query = query.lt('created_at', before)
    const { data } = await query
    const list = normalizePosts(data)
    const newCards = await fetchProfileCards(list.map((p) => p.author_id))
    setCards((prev) => ({ ...prev, ...newCards }))
    setPosts((prev) => (before ? [...prev, ...list] : list))
    setHasMore(list.length === PAGE_SIZE)
  }, [])

  useEffect(() => {
    loadPage().finally(() => setLoading(false))
  }, [loadPage])

  // 목록 끝에 닿으면 다음 글을 불러와요.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore && posts.length > 0) {
        setLoadingMore(true)
        loadPage(posts[posts.length - 1].created_at).finally(() => setLoadingMore(false))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, posts, loadPage])

  async function handleLike(postId: number) {
    if (!profile) {
      navigate('/me')
      return
    }
    const nowLiked = !likedIds.has(postId)
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, like_count: p.like_count + (nowLiked ? 1 : -1) } : p)))
    await toggle(postId)
  }

  const visiblePosts = posts.filter((p) => !p.author_id || !blockedIds.has(p.author_id))

  return (
    <section className="feed-page">
      <header className="app-bar feed-bar">
        <span className="brand-mark">
          <span className="orb" aria-hidden="true" />
          {BRAND_NAME}
        </span>
        <span className="feed-bar__tagline">{FEED_COPY.headerTagline}</span>
        <DmButton />
      </header>

      {!profile && (
        <div className="guest-strip glass-panel">
          <p>{GUEST_COPY.browseNotice}</p>
          <button type="button" className="pill-button pill-button--sm" onClick={() => navigate('/me')}>
            {GUEST_COPY.ctaLogin}
          </button>
        </div>
      )}

      <div className="sheet feed-sheet">
        {loading ? (
          <Loading />
        ) : visiblePosts.length === 0 ? (
          <div className="empty-state">
            <span className="orb orb--md" aria-hidden="true" />
            <p>{FEED_COPY.empty}</p>
          </div>
        ) : (
          <div className="feed-list" data-testid="feed-list">
            {visiblePosts.map((post) => (
              <PostItem
                key={post.id}
                post={post}
                author={post.author_id ? cards[post.author_id] : undefined}
                liked={likedIds.has(post.id)}
                onLike={() => handleLike(post.id)}
                onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              />
            ))}
          </div>
        )}
        <div ref={sentinelRef} />
        {loadingMore && <Loading />}
      </div>

      <p className="feed-footnote">{FEED_NATIONWIDE_NOTICE}</p>
    </section>
  )
}
