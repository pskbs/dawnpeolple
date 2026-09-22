import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppBar, Avatar, Loading } from '../../components/ui'
import { PROFILE_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { fetchProfileCard, fetchProfileCards, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { useMyFollowing } from './profile-api'
import './ProfilePage.css'

type Tab = 'followers' | 'following'

export function FollowListPage() {
  const { id } = useParams()
  const { profile, blockedIds } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: Tab = searchParams.get('tab') === 'following' ? 'following' : 'followers'
  const [owner, setOwner] = useState<ProfileCard | null>(null)
  const [lists, setLists] = useState<Record<Tab, string[]>>({ followers: [], following: [] })
  const [cards, setCards] = useState<Record<string, ProfileCard>>({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const myFollowing = useMyFollowing(profile?.id)

  useEffect(() => {
    if (!id) return
    async function load(userId: string) {
      const [ownerCard, { data: followerRows }, { data: followingRows }] = await Promise.all([
        fetchProfileCard(userId),
        supabase.from('follows').select('follower_id').eq('following_id', userId).order('created_at', { ascending: false }).limit(500),
        supabase.from('follows').select('following_id').eq('follower_id', userId).order('created_at', { ascending: false }).limit(500),
      ])
      const followers = (followerRows ?? []).map((r) => r.follower_id as string)
      const following = (followingRows ?? []).map((r) => r.following_id as string)
      setOwner(ownerCard)
      setLists({ followers, following })
      setCards(await fetchProfileCards([...followers, ...following]))
      setLoading(false)
    }
    load(id)
  }, [id])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return lists[tab]
      .filter((uid) => !blockedIds.has(uid))
      .map((uid) => cards[uid])
      .filter((c): c is ProfileCard => !!c)
      .filter((c) => !q || c.nickname.toLowerCase().includes(q))
  }, [lists, tab, cards, query, blockedIds])

  return (
    <section className="follow-page">
      <AppBar back title={owner?.nickname} />

      <div className="sheet">
        <div className="seg-tabs" role="tablist">
          {(
            [
              ['followers', PROFILE_COPY.followers],
              ['following', PROFILE_COPY.following],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className="seg-tabs__item"
              onClick={() => setSearchParams({ tab: key }, { replace: true })}
            >
              {label}
              <span className="seg-tabs__count">{lists[key].length}</span>
            </button>
          ))}
        </div>

        <div className="follow-search">
          <input
            className="field-input"
            type="search"
            placeholder={PROFILE_COPY.searchPlaceholder}
            aria-label={PROFILE_COPY.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="profile-empty">
            {tab === 'followers' ? PROFILE_COPY.followListEmptyFollowers : PROFILE_COPY.followListEmptyFollowing}
          </p>
        ) : (
          <ul className="list-rows">
            {rows.map((c) => {
              const isSelf = c.id === profile?.id
              const iFollow = myFollowing.ids.has(c.id)
              return (
                <li key={c.id} className="person-row">
                  <Link to={`/u/${c.id}`}>
                    <Avatar name={c.nickname} seed={c.id} src={c.avatar_url} size="md" />
                  </Link>
                  <Link to={`/u/${c.id}`} className="person-row__text">
                    <span className="person-row__name">{c.nickname}</span>
                    {c.bio && <span className="person-row__sub">{c.bio}</span>}
                  </Link>
                  {!isSelf && (
                    <button
                      type="button"
                      className={iFollow ? 'pill-button-ghost' : 'pill-button pill-button--dark'}
                      onClick={() => (profile ? myFollowing.toggle(c.id) : navigate('/me'))}
                    >
                      {iFollow ? PROFILE_COPY.unfollow : PROFILE_COPY.follow}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
