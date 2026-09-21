import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export type FeedPost = {
  id: number
  body: string
  like_count: number
  comment_count: number
  created_at: string
  author_id: string | null
}

export type FeedComment = {
  id: number
  body: string
  author_id: string | null
  created_at: string
}

export const POST_COLUMNS = 'id, body, like_count, comment_count, created_at, author_id'
export const COMMENT_COLUMNS = 'id, body, author_id, created_at'

export async function fetchNicknames(ids: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  if (unique.length === 0) return {}
  const { data } = await supabase.from('profile_cards').select('id, nickname').in('id', unique)
  const map: Record<string, string> = {}
  for (const card of data ?? []) map[card.id] = card.nickname
  return map
}

export function useLikedPosts(userId: string | undefined) {
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!userId) {
      setLikedIds(new Set())
      return
    }
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .then(({ data }) => setLikedIds(new Set((data ?? []).map((row) => row.post_id as number))))
  }, [userId])

  // 낙관적 업데이트 후 서버 반영. 반환값은 토글 뒤 좋아요 여부.
  async function toggle(postId: number): Promise<boolean> {
    if (!userId) return false
    const wasLiked = likedIds.has(postId)
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (wasLiked) next.delete(postId)
      else next.add(postId)
      return next
    })
    if (wasLiked) {
      await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId)
    } else {
      await supabase.from('post_likes').insert({ user_id: userId, post_id: postId })
    }
    return !wasLiked
  }

  return { likedIds, toggle }
}
