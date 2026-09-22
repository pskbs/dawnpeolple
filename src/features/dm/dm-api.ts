import { useEffect, useState } from 'react'
import { FEATURES } from '../../config/features'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'

export type Conversation = {
  id: number
  user_a: string
  user_b: string
  last_message_at: string
  last_message_preview: string | null
  last_sender_id: string | null
}

export function otherUserOf(c: Conversation, me: string) {
  return c.user_a === me ? c.user_b : c.user_a
}

// 안 읽은 메시지 수. 새 메시지가 오면 실시간으로 다시 세요.
export function useUnreadCount() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)
  const userId = profile?.id

  useEffect(() => {
    if (!FEATURES.dm || !userId) return
    let alive = true
    const refresh = () =>
      supabase.rpc('unread_message_count').then(({ data }) => {
        if (alive) setCount((data as number) ?? 0)
      })
    refresh()
    const channel = supabase
      .channel(`unread-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refresh)
      .subscribe()
    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [userId])

  return userId ? count : 0
}

export async function startConversation(otherUserId: string): Promise<number> {
  const { data, error } = await supabase.rpc('start_conversation', { p_other: otherUserId })
  if (error || !data) throw new Error(error?.message ?? '')
  return data as number
}
