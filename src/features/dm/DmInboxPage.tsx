import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AppBar, Avatar, BottomSheet, Icon, Loading } from '../../components/ui'
import { DM_COPY, MENU_COPY, NOTIFICATION_COPY } from '../../config/copy'
import { FEATURES } from '../../config/features'
import { useAuth } from '../../lib/auth-context'
import { formatRelativeTime } from '../../lib/format'
import { fetchProfileCards, UNKNOWN_NICKNAME, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { NotificationList } from '../notifications/NotificationList'
import { NotificationSettingsSection } from '../notifications/NotificationSettingsSection'
import { useUnreadNotificationCount } from '../notifications/notifications-api'
import '../notifications/Notifications.css'
import { otherUserOf, useUnreadCount, type Conversation } from './dm-api'
import './DmPage.css'

type Tab = 'messages' | 'notifications'

// 메시지 화면: 위쪽 탭으로 대화 목록과 알림 목록을 오가요. 오른쪽 위 톱니바퀴로 종류별 알림을 끌 수 있어요.
export function DmInboxPage() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'notifications' ? 'notifications' : 'messages'
  const [settingsOpen, setSettingsOpen] = useState(false)
  const unreadMessages = useUnreadCount()
  const unreadNotifications = useUnreadNotificationCount()

  if (!FEATURES.dm) return <Navigate to="/feed" replace />
  if (!profile) return <Navigate to="/me" replace />

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'messages', label: NOTIFICATION_COPY.tabMessages, count: unreadMessages },
    { key: 'notifications', label: NOTIFICATION_COPY.tabNotifications, count: unreadNotifications },
  ]

  return (
    <section className="dm-page">
      <AppBar
        back
        title={DM_COPY.title}
        right={
          <button
            type="button"
            className="circle-button"
            aria-label={NOTIFICATION_COPY.settingsButton}
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="settings-icon" />
          </button>
        }
      />

      <div className="inbox-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className="inbox-tabs__tab"
            onClick={() => setParams(t.key === 'messages' ? {} : { tab: t.key }, { replace: true })}
          >
            {t.label}
            {t.count > 0 && <span className="inbox-tabs__count">{t.count > 99 ? '99+' : t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'messages' ? <ConversationList /> : <NotificationList />}

      <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={NOTIFICATION_COPY.settingsTitle}>
        <NotificationSettingsSection />
        <button type="button" className="sheet-cancel" onClick={() => setSettingsOpen(false)}>
          {MENU_COPY.cancel}
        </button>
      </BottomSheet>
    </section>
  )
}

function ConversationList() {
  const { profile, blockedIds } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [cards, setCards] = useState<Record<string, ProfileCard>>({})
  const [unread, setUnread] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const myId = profile?.id

  const load = useCallback(async () => {
    if (!myId) return
    const [{ data: convRows }, { data: unreadRows }] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, user_a, user_b, last_message_at, last_message_preview, last_sender_id')
        .not('last_sender_id', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(100),
      supabase.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', myId).limit(1000),
    ])
    const list = (convRows ?? []) as Conversation[]
    const counts: Record<number, number> = {}
    for (const r of unreadRows ?? []) counts[r.conversation_id as number] = (counts[r.conversation_id as number] ?? 0) + 1
    setConversations(list)
    setUnread(counts)
    setCards(await fetchProfileCards(list.map((c) => otherUserOf(c, myId))))
    setLoading(false)
  }, [myId])

  useEffect(() => {
    load()
    if (!myId) return
    const channel = supabase
      .channel(`inbox-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, myId])

  if (!profile) return null
  if (loading) return <Loading />

  const visible = conversations.filter((c) => !blockedIds.has(otherUserOf(c, profile.id)))

  if (visible.length === 0) {
    return (
      <div className="empty-state">
        <span className="orb orb--md" aria-hidden="true" />
        <p>{DM_COPY.empty}</p>
        <p className="muted">{DM_COPY.emptyHint}</p>
      </div>
    )
  }

  return (
    <ul className="sheet list-rows dm-list">
      {visible.map((c) => {
        const otherId = otherUserOf(c, profile.id)
        const card = cards[otherId]
        const name = card?.nickname ?? UNKNOWN_NICKNAME
        const preview = c.last_message_preview ?? DM_COPY.attachmentPreview
        const count = unread[c.id] ?? 0
        return (
          <li key={c.id}>
            <Link to={`/dm/${c.id}`} className="person-row dm-row">
              <Avatar name={name} seed={otherId} src={card?.avatar_url} size="md" />
              <span className="person-row__text">
                <span className="person-row__name">{name}</span>
                <span className={`person-row__sub${count > 0 ? ' dm-row__sub--unread' : ''}`}>
                  {c.last_sender_id === profile.id ? `${DM_COPY.me}: ` : ''}
                  {preview}
                </span>
              </span>
              <span className="dm-row__side">
                <span className="dm-row__time">{formatRelativeTime(c.last_message_at)}</span>
                {count > 0 && <span className="dm-row__badge">{count}</span>}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
