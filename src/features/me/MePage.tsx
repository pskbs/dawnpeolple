import { useEffect, useState } from 'react'
import { Avatar, Icon, Loading } from '../../components/ui'
import { REGION_LABEL } from '../../config/brand'
import { ME_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { POST_COLUMNS, useLikedPosts, type FeedPost } from '../feed/feed-api'
import { PostItem } from '../feed/PostItem'
import './MePage.css'

const GENDER_LABELS: Record<string, string> = { male: '남성', female: '여성' }

const WORK_TYPE_LABELS: Record<string, string> = {
  nursing: '간호·의료',
  business: '사장님·자영업',
  service: '서비스·판매',
  manufacturing: '제조·물류 교대',
  freelance: '프리랜서·크리에이터',
  etc: '기타',
}

export function MePage() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [postCount, setPostCount] = useState(0)
  const [bungaeCount, setBungaeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const { likedIds, toggle } = useLikedPosts(profile?.id)

  useEffect(() => {
    if (!profile) return
    async function load(userId: string) {
      const [postRes, bungaeRes] = await Promise.all([
        supabase
          .from('posts')
          .select(POST_COLUMNS, { count: 'exact' })
          .eq('author_id', userId)
          .eq('status', 'visible')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('bungae_participants')
          .select('bungae_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'joined'),
      ])
      setPosts((postRes.data ?? []) as FeedPost[])
      setPostCount(postRes.count ?? 0)
      setBungaeCount(bungaeRes.count ?? 0)
      setLoading(false)
    }
    load(profile.id)
  }, [profile])

  if (!profile) return null

  const ageBand = profile.birth_year ? `${Math.floor((new Date().getFullYear() - profile.birth_year) / 10) * 10}대` : null
  const likeTotal = posts.reduce((sum, p) => sum + p.like_count, 0)

  async function handleLike(postId: number) {
    const nowLiked = !likedIds.has(postId)
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, like_count: p.like_count + (nowLiked ? 1 : -1) } : p)))
    await toggle(postId)
  }

  return (
    <section className="me-page">
      <header className="app-bar">
        <span className="app-bar__spacer" />
        <h1 className="app-bar__title">{ME_COPY.title}</h1>
        <span className="app-bar__spacer" />
      </header>

      <div className="me-card glass-panel">
        <span className="avatar-ring">
          <Avatar name={profile.nickname} seed={profile.id} size="lg" />
        </span>
        <h1>{profile.nickname}</h1>
        <p className="me-sub">
          {[GENDER_LABELS[profile.gender ?? ''], ageBand, profile.sigungu ?? REGION_LABEL].filter(Boolean).join(' · ')}
        </p>
        {profile.work_type && (
          <span className="badge">{WORK_TYPE_LABELS[profile.work_type] ?? profile.work_type}</span>
        )}

        <dl className="me-stats">
          <div>
            <dt>{ME_COPY.statPosts}</dt>
            <dd>{postCount}</dd>
          </div>
          <div>
            <dt>{ME_COPY.statLikes}</dt>
            <dd>{likeTotal}</dd>
          </div>
          <div>
            <dt>{ME_COPY.statBungaes}</dt>
            <dd>{bungaeCount}</dd>
          </div>
        </dl>
      </div>

      <div className="sheet">
        <h2 className="me-section-title">{ME_COPY.myPostsTitle}</h2>
        {loading ? (
          <Loading />
        ) : posts.length === 0 ? (
          <p className="me-empty">{ME_COPY.myPostsEmpty}</p>
        ) : (
          posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              nickname={profile.nickname}
              liked={likedIds.has(post.id)}
              onLike={() => handleLike(post.id)}
            />
          ))
        )}
      </div>

      <div className="glass-panel me-info-list">
        <h2 className="me-info-title">{ME_COPY.infoTitle}</h2>
        {profile.work_type && (
          <div className="me-info-row">
            <span>{ME_COPY.workType}</span>
            <span>{WORK_TYPE_LABELS[profile.work_type] ?? profile.work_type}</span>
          </div>
        )}
        <div className="me-info-row">
          <span>{ME_COPY.region}</span>
          <span>
            {profile.sido} {profile.sigungu}
          </span>
        </div>
      </div>

      <button type="button" className="pill-button-ghost me-logout" onClick={() => supabase.auth.signOut()}>
        <Icon name="logout-icon" className="me-logout__icon" />
        {ME_COPY.logout}
      </button>
    </section>
  )
}
