import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DmButton } from '../../components/DmButton'
import { ExpandableText, MediaGallery } from '../../components/media'
import { MoreMenu } from '../../components/MoreMenu'
import { useToast } from '../../components/toast'
import { AppBar, Avatar, Icon, Loading } from '../../components/ui'
import { BUNGAE_COPY, DM_COPY, LOCATION_COPY, MENU_COPY, PROFILE_COPY } from '../../config/copy'
import { FEATURES } from '../../config/features'
import { useAuth } from '../../lib/auth-context'
import { formatRelativeTime } from '../../lib/format'
import { asMediaList, type MediaItem } from '../../lib/media'
import { fetchProfileCard, WORK_TYPE_LABELS, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { dateTileParts, type Bungae } from '../bungae/bungae-types'
import { startConversation } from '../dm/dm-api'
import { normalizePosts, POST_COLUMNS, sharePath, useLikedPosts, type FeedPost } from '../feed/feed-api'
import { PostItem } from '../feed/PostItem'
import { isBlockedByUser, useFollowState } from './profile-api'
import './ProfilePage.css'

type Tab = 'posts' | 'replies' | 'bungaes'

type ReplyRow = {
  id: number
  body: string
  media: MediaItem[]
  created_at: string
  post_id: number
  posts: { id: number; body: string } | null
}

type BungaeRow = Pick<Bungae, 'id' | 'title' | 'starts_at' | 'place_hint' | 'sigungu' | 'status'> & {
  role: 'host' | 'joined'
}

// /u/:id — 다른 사람 프로필. 내 id면 /me로 보내요.
export function UserProfileRoute() {
  const { id } = useParams()
  const { profile } = useAuth()
  if (!id) return <Navigate to="/feed" replace />
  if (profile && id === profile.id) return <Navigate to="/me" replace />
  return <ProfilePage userId={id} />
}

// 스레드식 프로필: 상단 기본 정보·팔로워, 버튼, 탭(수다글/답글/소모임)
export function ProfilePage({ userId }: { userId: string }) {
  const { profile, blockedIds, unblock } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) || 'posts'
  const isMe = profile?.id === userId

  const [fetchedCard, setFetchedCard] = useState<ProfileCard | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [replies, setReplies] = useState<ReplyRow[]>([])
  const [bungaes, setBungaes] = useState<BungaeRow[]>([])
  const [tabLoading, setTabLoading] = useState(true)
  const follow = useFollowState(userId, profile?.id)
  const { likedIds, toggle } = useLikedPosts(profile?.id)
  const blocked = blockedIds.has(userId)
  const reloadFollow = follow.reload

  // 차단하면 서버에서 팔로우가 끊기므로, 차단/해제 뒤 관계를 다시 불러와요.
  useEffect(() => {
    reloadFollow()
  }, [blocked, reloadFollow])

  // 내 프로필은 로그인 정보에서 바로, 다른 사람은 공개 카드(profile_cards)에서 불러와요.
  useEffect(() => {
    if (isMe) return
    let alive = true
    fetchProfileCard(userId).then((c) => {
      if (!alive) return
      setFetchedCard(c)
      setFetchedFor(userId)
    })
    return () => {
      alive = false
    }
  }, [userId, isMe])

  const card: ProfileCard | null =
    isMe && profile
      ? {
          id: profile.id,
          nickname: profile.nickname,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          work_type: profile.work_type,
          show_work_badge: profile.show_work_badge,
        }
      : fetchedFor === userId
        ? fetchedCard
        : null
  const cardLoading = !isMe && fetchedFor !== userId

  useEffect(() => {
    if (blocked) return
    let alive = true
    async function loadTab() {
      setTabLoading(true)
      if (tab === 'posts') {
        const { data } = await supabase
          .from('posts')
          .select(POST_COLUMNS)
          .eq('author_id', userId)
          .eq('status', 'visible')
          .order('created_at', { ascending: false })
          .limit(50)
        if (alive) setPosts(normalizePosts(data))
      } else if (tab === 'replies') {
        const { data } = await supabase
          .from('comments')
          .select('id, body, media, created_at, post_id, posts(id, body)')
          .eq('author_id', userId)
          .eq('status', 'visible')
          .order('created_at', { ascending: false })
          .limit(50)
        if (alive) setReplies(((data ?? []) as unknown as ReplyRow[]).map((r) => ({ ...r, media: asMediaList(r.media) })))
      } else {
        const columns = 'id, title, starts_at, place_hint, sigungu, status'
        const [{ data: hosted }, { data: joinedRows }] = await Promise.all([
          supabase.from('bungaes').select(columns).eq('host_id', userId).order('starts_at', { ascending: false }).limit(30),
          // 참석 기록은 본인만 조회할 수 있어요(RLS). 다른 사람 프로필에서는 연 소모임만 보여요.
          isMe
            ? supabase
                .from('bungae_participants')
                .select(`bungaes(${columns})`)
                .eq('user_id', userId)
                .eq('status', 'joined')
                .limit(30)
            : Promise.resolve({ data: [] }),
        ])
        const hostedList = ((hosted ?? []) as Omit<BungaeRow, 'role'>[]).map((b) => ({ ...b, role: 'host' as const }))
        const hostedIds = new Set(hostedList.map((b) => b.id))
        const joinedList = ((joinedRows ?? []) as unknown as { bungaes: Omit<BungaeRow, 'role'> | null }[])
          .map((r) => r.bungaes)
          .filter((b): b is Omit<BungaeRow, 'role'> => !!b && !hostedIds.has(b.id))
          .map((b) => ({ ...b, role: 'joined' as const }))
        const merged = [...hostedList, ...joinedList].sort((a, b) => b.starts_at.localeCompare(a.starts_at))
        if (alive) setBungaes(merged)
      }
      if (alive) setTabLoading(false)
    }
    loadTab()
    return () => {
      alive = false
    }
  }, [tab, userId, isMe, blocked])

  function setTab(next: Tab) {
    setSearchParams(next === 'posts' ? {} : { tab: next }, { replace: true })
  }

  async function handleLike(postId: number) {
    if (!profile) {
      navigate('/me')
      return
    }
    const nowLiked = !likedIds.has(postId)
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, like_count: p.like_count + (nowLiked ? 1 : -1) } : p)))
    await toggle(postId)
  }

  async function handleFollow() {
    if (!profile) {
      navigate('/me')
      return
    }
    if (!follow.iFollow && (await isBlockedByUser(userId))) {
      toast.show(MENU_COPY.blockedByOther)
      return
    }
    await follow.toggle()
  }

  async function handleMessage() {
    if (!profile) {
      navigate('/me')
      return
    }
    if (await isBlockedByUser(userId)) {
      toast.show(DM_COPY.blockedByOther)
      return
    }
    try {
      const conversationId = await startConversation(userId)
      navigate(`/dm/${conversationId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      toast.show(message.includes('차단') ? message : DM_COPY.startError)
    }
  }

  async function handleShare() {
    const result = await sharePath(`/u/${userId}`)
    if (result === 'copied') toast.show(PROFILE_COPY.shareCopied)
  }

  if (cardLoading) {
    return (
      <section className="profile-page">
        <AppBar back={isMe ? undefined : true} />
        <Loading />
      </section>
    )
  }

  if (!card) {
    return (
      <section className="profile-page">
        <AppBar back />
        <div className="empty-state">
          <span className="orb orb--md" aria-hidden="true" />
          <p>{PROFILE_COPY.notFound}</p>
        </div>
      </section>
    )
  }

  const followLabel = follow.iFollow ? PROFILE_COPY.unfollow : follow.followsMe ? PROFILE_COPY.followBack : PROFILE_COPY.follow
  const workLabel = card.work_type && card.show_work_badge ? WORK_TYPE_LABELS[card.work_type] : null

  const header = isMe ? (
    <header className="app-bar">
      <span className="app-bar__spacer" />
      <h1 className="app-bar__title">{PROFILE_COPY.title}</h1>
      <div className="app-bar__actions">
        <DmButton />
        <Link to="/me/settings" className="icon-button icon-button--dark" aria-label={PROFILE_COPY.settings}>
          <Icon name="settings-icon" />
        </Link>
      </div>
    </header>
  ) : (
    <AppBar
      back
      right={
        <MoreMenu isMine={false} authorId={card.id} authorName={card.nickname} report={{ type: 'user', id: card.id }} />
      }
    />
  )

  return (
    <section className="profile-page">
      {header}

      <div className="profile-head">
        <div className="profile-head__top">
          <div className="profile-head__names">
            <h1 className="profile-head__nickname">{card.nickname}</h1>
            {workLabel && <span className="badge">{workLabel}</span>}
          </div>
          <Avatar name={card.nickname} seed={card.id} src={card.avatar_url} size="xl" />
        </div>
        {card.bio && <p className="profile-head__bio">{card.bio}</p>}
        {isMe && profile && (
          <p className="profile-head__region">
            <Icon name="pin-icon" />
            {profile.sigungu || LOCATION_COPY.unset}
          </p>
        )}
        <div className="profile-head__follows">
          <Link to={`/u/${card.id}/follows?tab=followers`}>{PROFILE_COPY.followersCount(follow.followers)}</Link>
          <span aria-hidden="true">·</span>
          <Link to={`/u/${card.id}/follows?tab=following`}>{PROFILE_COPY.followingCount(follow.following)}</Link>
        </div>

        <div className="profile-head__buttons">
          {isMe ? (
            <>
              <Link to="/me/edit" className="pill-button-ghost">
                {PROFILE_COPY.editProfile}
              </Link>
              <button type="button" className="pill-button-ghost" onClick={handleShare}>
                {PROFILE_COPY.shareProfile}
              </button>
            </>
          ) : blocked ? (
            <button
              type="button"
              className="pill-button-ghost"
              onClick={async () => {
                await unblock(card.id)
                toast.show(MENU_COPY.unblockDone)
              }}
            >
              {MENU_COPY.unblock}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={follow.iFollow ? 'pill-button-ghost' : 'pill-button pill-button--dark'}
                disabled={follow.busy}
                onClick={handleFollow}
              >
                {followLabel}
              </button>
              {FEATURES.dm && (
                <button type="button" className="pill-button-ghost" onClick={handleMessage}>
                  {PROFILE_COPY.message}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {blocked ? (
        <p className="profile-blocked">{PROFILE_COPY.blockedNotice}</p>
      ) : (
        <div className="sheet profile-sheet">
          <div className="seg-tabs" role="tablist">
            {(
              [
                ['posts', PROFILE_COPY.tabPosts],
                ['replies', PROFILE_COPY.tabReplies],
                ['bungaes', PROFILE_COPY.tabBungaes],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className="seg-tabs__item"
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {tabLoading ? (
            <Loading />
          ) : tab === 'posts' ? (
            posts.length === 0 ? (
              isMe ? (
                <ProfileCompletion hasPhoto={!!card.avatar_url} hasBio={!!card.bio} />
              ) : (
                <p className="profile-empty">{PROFILE_COPY.emptyPosts}</p>
              )
            ) : (
              posts.map((post) => (
                <PostItem
                  key={post.id}
                  post={post}
                  author={card}
                  liked={likedIds.has(post.id)}
                  onLike={() => handleLike(post.id)}
                  onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                />
              ))
            )
          ) : tab === 'replies' ? (
            replies.length === 0 ? (
              <p className="profile-empty">{PROFILE_COPY.emptyReplies}</p>
            ) : (
              <ul className="profile-replies">
                {replies.map((r) => (
                  <li key={r.id}>
                    <Link to={`/feed/${r.post_id}`} className="profile-reply">
                      {r.posts && <span className="profile-reply__origin">{r.posts.body || PROFILE_COPY.repliedOn}</span>}
                      <span className="profile-reply__head">
                        <Avatar name={card.nickname} seed={card.id} src={card.avatar_url} size="xs" />
                        <strong>{card.nickname}</strong>
                        <span className="muted">{formatRelativeTime(r.created_at)}</span>
                      </span>
                      <ExpandableText text={r.body} className="profile-reply__body" />
                      <MediaGallery items={r.media} compact />
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : bungaes.length === 0 ? (
            <p className="profile-empty">{PROFILE_COPY.emptyBungaes}</p>
          ) : (
            <ul className="profile-bungaes">
              {bungaes.map((b) => {
                const tile = dateTileParts(b.starts_at)
                return (
                  <li key={b.id}>
                    <Link to={`/bungae/${b.id}`} className="profile-bungae">
                      <span className="date-tile">
                        <strong>{tile.day}</strong>
                        <small>{tile.weekday}</small>
                      </span>
                      <span className="profile-bungae__text">
                        <strong>{b.title}</strong>
                        <span className="muted">
                          {tile.time} · {b.place_hint ?? b.sigungu}
                        </span>
                      </span>
                      <span className="badge">
                        {b.role === 'host' ? BUNGAE_COPY.hostBadge : PROFILE_COPY.joinedTag}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

// 스레드의 "프로필 완성하기"처럼, 비어 있는 항목을 카드로 안내해요.
function ProfileCompletion({ hasPhoto, hasBio }: { hasPhoto: boolean; hasBio: boolean }) {
  const items = [
    { key: 'post', icon: 'edit-icon', title: PROFILE_COPY.completePost, desc: PROFILE_COPY.completePostDesc, to: '/feed/new' },
    ...(!hasBio
      ? [{ key: 'bio', icon: 'user-icon', title: PROFILE_COPY.completeBio, desc: PROFILE_COPY.completeBioDesc, to: '/me/edit' }]
      : []),
    ...(!hasPhoto
      ? [{ key: 'photo', icon: 'camera-icon', title: PROFILE_COPY.completePhoto, desc: PROFILE_COPY.completePhotoDesc, to: '/me/edit' }]
      : []),
  ]
  return (
    <div className="profile-complete">
      <p className="profile-complete__title">{PROFILE_COPY.completeTitle}</p>
      <div className="profile-complete__grid">
        {items.map((it) => (
          <Link key={it.key} to={it.to} className="profile-complete__card">
            <span className="circle-button" aria-hidden="true">
              <Icon name={it.icon} />
            </span>
            <strong>{it.title}</strong>
            <span>{it.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
