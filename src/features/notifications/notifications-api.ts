import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'

export type NotificationType = 'comment' | 'comment_reply' | 'dm' | 'bungae_join'

export type AppNotification = {
  id: number
  type: NotificationType
  title: string
  body: string
  link: string
  actor_id: string | null
  read_at: string | null
  created_at: string
}

export type NotificationSettings = Record<NotificationType, boolean>

export const NOTIFICATION_TYPES: NotificationType[] = ['comment', 'comment_reply', 'dm', 'bungae_join']

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  comment: 'chat-icon',
  comment_reply: 'reply-icon',
  dm: 'send-icon',
  bungae_join: 'group-icon',
}

const DEFAULT_SETTINGS: NotificationSettings = { comment: true, comment_reply: true, dm: true, bungae_join: true }

// 알림 목록·안 읽은 수는 새 알림이 오면 실시간으로 다시 불러와요.
function useNotificationChannel(userId: string | undefined, onChange: () => void, key: string) {
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`${key}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        onChange,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, onChange, key])
}

export function useNotifications() {
  const { profile } = useAuth()
  const userId = profile?.id
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, actor_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setItems((data ?? []) as AppNotification[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])
  useNotificationChannel(userId, load, 'notifications')

  async function markRead(id: number) {
    setItems((prev) => prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    await supabase.from('notifications').update({ read_at: now }).is('read_at', null)
  }

  return { items, loading, markRead, markAllRead }
}

export function useUnreadNotificationCount() {
  const { profile } = useAuth()
  const userId = profile?.id
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!userId) return
    const { count: c } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
    setCount(c ?? 0)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])
  useNotificationChannel(userId, refresh, 'notifications-unread')

  return userId ? count : 0
}

export async function markNotificationsReadByLink(link: string) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('link', link).is('read_at', null)
}

export function useNotificationSettings() {
  const { profile } = useAuth()
  const userId = profile?.id
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('notification_settings')
      .select('comment, comment_reply, dm, bungae_join')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setSettings(data ? (data as NotificationSettings) : DEFAULT_SETTINGS)
        setLoaded(true)
      })
  }, [userId])

  async function update(type: NotificationType, enabled: boolean) {
    if (!userId) return
    const next = { ...settings, [type]: enabled }
    setSettings(next)
    const { error } = await supabase
      .from('notification_settings')
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() })
    if (error) setSettings(settings)
    return !error
  }

  return { settings, loaded, update }
}
