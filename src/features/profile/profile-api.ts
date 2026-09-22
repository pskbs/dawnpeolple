import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export type FollowState = {
  followers: number
  following: number
  iFollow: boolean
  followsMe: boolean
}

// 프로필 주인의 팔로워·팔로잉 수와, 나와의 팔로우 관계
export function useFollowState(targetId: string | undefined, myId: string | undefined) {
  const [state, setState] = useState<FollowState>({ followers: 0, following: 0, iFollow: false, followsMe: false })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!targetId) return
    const [followersRes, followingRes, mineRes, backRes] = await Promise.all([
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', targetId),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', targetId),
      myId && myId !== targetId
        ? supabase.from('follows').select('follower_id').eq('follower_id', myId).eq('following_id', targetId).maybeSingle()
        : Promise.resolve({ data: null }),
      myId && myId !== targetId
        ? supabase.from('follows').select('follower_id').eq('follower_id', targetId).eq('following_id', myId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    setState({
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
      iFollow: !!mineRes.data,
      followsMe: !!backRes.data,
    })
  }, [targetId, myId])

  useEffect(() => {
    load()
  }, [load])

  async function toggle() {
    if (!targetId || !myId || busy) return
    setBusy(true)
    const next = !state.iFollow
    setState((s) => ({ ...s, iFollow: next, followers: s.followers + (next ? 1 : -1) }))
    const { error } = next
      ? await supabase.from('follows').insert({ follower_id: myId, following_id: targetId })
      : await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', targetId)
    if (error) await load()
    setBusy(false)
  }

  return { ...state, toggle, busy, reload: load }
}

// 목록 화면용: 내가 팔로우하는 사람 id 집합 + 토글
export function useMyFollowing(myId: string | undefined) {
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!myId) return
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', myId)
      .limit(2000)
      .then(({ data }) => setIds(new Set((data ?? []).map((r) => r.following_id as string))))
  }, [myId])

  async function toggle(targetId: string) {
    if (!myId || targetId === myId) return
    const has = ids.has(targetId)
    setIds((prev) => {
      const next = new Set(prev)
      if (has) next.delete(targetId)
      else next.add(targetId)
      return next
    })
    if (has) await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', targetId)
    else await supabase.from('follows').insert({ follower_id: myId, following_id: targetId })
  }

  return { ids: myId ? ids : new Set<string>(), toggle }
}

export function ageBandOf(birthYear: number | null) {
  if (!birthYear) return null
  return `${Math.floor((new Date().getFullYear() - birthYear) / 10) * 10}대`
}
