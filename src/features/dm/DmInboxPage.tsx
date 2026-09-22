import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AppBar, Avatar, Loading } from '../../components/ui'
import { DM_COPY } from '../../config/copy'
import { FEATURES } from '../../config/features'
import { useAuth } from '../../lib/auth-context'
import { formatRelativeTime } from '../../lib/format'
import { fetchProfileCards, UNKNOWN_NICKNAME, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { otherUserOf, type Conversation } from './dm-api'
import './DmPage.css'

export function DmInboxPage() {
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

  if (!FEATURES.dm) return <Navigate to="/feed" replace />
  if (!profile) return <Navigate to="/me" replace />

  const visible = conversations.filter((c) => !blockedIds.has(otherUserOf(c, profile.id)))

  return (
    <section className="dm-page">
      <AppBar back title={DM_COPY.title} />

      {loading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <span className="orb orb--md" aria-hidden="true" />
          <p>{DM_COPY.empty}</p>
          <p className="muted">{DM_COPY.emptyHint}</p>
        </div>
      ) : (
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
      )}
    </section>
  )
}
