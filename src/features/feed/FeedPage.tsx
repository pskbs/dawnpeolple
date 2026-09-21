import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Icon, Loading } from '../../components/ui'
import { BRAND_NAME } from '../../config/brand'
import {
  CONCEPT_COPY,
  FEED_COMPOSER_PLACEHOLDER,
  FEED_COPY,
  FEED_NATIONWIDE_NOTICE,
  GUEST_COPY,
  SORT_COPY,
} from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import type { Bungae } from '../bungae/bungae-types'
import { fetchNicknames, POST_COLUMNS, useLikedPosts, type FeedPost } from './feed-api'
import { PostItem } from './PostItem'
import './FeedPage.css'

type StoryBungae = Pick<Bungae, 'id' | 'title' | 'starts_at'>

function storyTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function storyDay(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function FeedPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [stories, setStories] = useState<StoryBungae[]>([])
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest')
  const { likedIds, toggle } = useLikedPosts(profile?.id)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: postRows }, { data: bungaeRows }] = await Promise.all([
        supabase
          .from('posts')
          .select(POST_COLUMNS)
          .eq('status', 'visible')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('bungaes')
          .select('id, title, starts_at')
          .in('status', ['open', 'full'])
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(12),
      ])
      const list = (postRows ?? []) as FeedPost[]
      setPosts(list)
      setStories((bungaeRows ?? []) as StoryBungae[])
      setNicknames(await fetchNicknames(list.map((p) => p.author_id)))
      setLoading(false)
    }
    load()
  }, [])

  async function handleLike(postId: number) {
    if (!profile) {
      navigate('/me')
      return
    }
    const nowLiked = !likedIds.has(postId)
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, like_count: p.like_count + (nowLiked ? 1 : -1) } : p)))
    await toggle(postId)
  }

  const sortedPosts = useMemo(() => {
    const list = [...posts]
    if (sortMode === 'popular') {
      list.sort((a, b) => b.like_count - a.like_count || b.created_at.localeCompare(a.created_at))
    }
    return list
  }, [posts, sortMode])

  return (
    <section className="feed-page">
      <header className="app-bar">
        <span className="brand-mark">
          <span className="orb" aria-hidden="true" />
          {BRAND_NAME}
        </span>
        {profile ? (
          <Link to="/me" className="feed-me-link" aria-label="내정보">
            <Avatar name={profile.nickname} seed={profile.id} size="sm" />
          </Link>
        ) : (
          <Link to="/me" className="pill-button pill-button--sm">
            로그인
          </Link>
        )}
      </header>

      <div className="feed-hero">
        <p className="feed-hero__greeting">
          {profile ? FEED_COPY.greeting(profile.nickname) : FEED_COPY.greetingGuest}
          <Icon name="moon-icon" className="feed-hero__moon" />
        </p>
        <h2 className="feed-hero__headline">{CONCEPT_COPY.primary}</h2>
      </div>

      <button
        type="button"
        className="composer-bar feed-composer-trigger"
        onClick={() => navigate(profile ? '/feed/new' : '/me')}
      >
        <span className="orb feed-composer-trigger__orb" aria-hidden="true" />
        <span className="feed-composer-trigger__text">{FEED_COMPOSER_PLACEHOLDER}</span>
        <span className="circle-button circle-button--primary circle-button--sm" aria-hidden="true">
          <Icon name="arrow-right-icon" />
        </span>
      </button>

      <div className="stories">
        <div className="stories__head">
          <h3>{FEED_COPY.storiesTitle}</h3>
          <Link to="/bungae" className="stories__all">
            {FEED_COPY.storiesAll}
          </Link>
        </div>
        <ul className="stories__list">
          <li>
            <Link to={profile ? '/bungae/new' : '/me'} className="story story--create">
              <span className="story__bubble">
                <Icon name="plus-icon" />
              </span>
              <span className="story__label">{FEED_COPY.storiesCreate}</span>
            </Link>
          </li>
          {stories.map((s) => (
            <li key={s.id}>
              <Link to={`/bungae/${s.id}`} className="story">
                <span className="avatar-ring">
                  <span className="story__bubble story__bubble--time">
                    <small>{storyDay(s.starts_at)}</small>
                    {storyTime(s.starts_at)}
                  </span>
                </span>
                <span className="story__label">{s.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {!profile && (
        <div className="guest-strip glass-panel">
          <p>{GUEST_COPY.browseNotice}</p>
          <button type="button" className="pill-button pill-button--sm" onClick={() => navigate('/me')}>
            {GUEST_COPY.ctaLogin}
          </button>
        </div>
      )}

      <div className="sheet feed-sheet">
        <div className="feed-tabs" role="tablist" aria-label="정렬">
          {(['latest', 'popular'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={sortMode === mode}
              className="feed-tabs__item"
              onClick={() => setSortMode(mode)}
            >
              {SORT_COPY[mode]}
            </button>
          ))}
        </div>

        {loading ? (
          <Loading />
        ) : sortedPosts.length === 0 ? (
          <div className="empty-state">
            <span className="orb orb--md" aria-hidden="true" />
            <p>{FEED_COPY.empty}</p>
          </div>
        ) : (
          <div className="feed-list" data-testid="feed-list">
            {sortedPosts.map((post) => (
              <PostItem
                key={post.id}
                post={post}
                nickname={(post.author_id && nicknames[post.author_id]) || '알 수 없음'}
                liked={likedIds.has(post.id)}
                onLike={() => handleLike(post.id)}
              />
            ))}
          </div>
        )}
      </div>

      <p className="feed-footnote">{FEED_NATIONWIDE_NOTICE}</p>
    </section>
  )
}
