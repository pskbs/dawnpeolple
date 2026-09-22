import { useEffect, useState } from 'react'
import { asMediaList, type MediaItem } from '../../lib/media'
import { supabase } from '../../lib/supabase'

export type FeedPost = {
  id: number
  body: string
  media: MediaItem[]
  like_count: number
  comment_count: number
  created_at: string
  edited_at: string | null
  author_id: string | null
}

export const POST_COLUMNS = 'id, body, media, like_count, comment_count, created_at, edited_at, author_id'

export function normalizePosts(rows: unknown[] | null): FeedPost[] {
  return ((rows ?? []) as FeedPost[]).map((p) => ({ ...p, media: asMediaList(p.media) }))
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

// 공유: 모바일은 시스템 공유 시트, 아니면 링크 복사
export async function sharePath(path: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = `${window.location.origin}${path}`
  try {
    if (navigator.share) {
      await navigator.share({ url })
      return 'shared'
    }
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
