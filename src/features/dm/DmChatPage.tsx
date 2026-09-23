import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AttachmentTray, MediaGallery } from '../../components/media'
import { MoreMenu } from '../../components/MoreMenu'
import { AppBar, Avatar, Icon, Loading, ProfileLink } from '../../components/ui'
import { DM_COPY } from '../../config/copy'
import { FEATURES } from '../../config/features'
import { useAuth } from '../../lib/auth-context'
import { formatRelativeTime } from '../../lib/format'
import { asMediaList, signDmMedia, uploadDmMedia, validateFile, type MediaItem } from '../../lib/media'
import { fetchProfileCard, UNKNOWN_NICKNAME, type ProfileCard } from '../../lib/profiles'
import { dispatchPush } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import { markNotificationsReadByLink } from '../notifications/notifications-api'
import { isBlockedByUser } from '../profile/profile-api'
import { otherUserOf, type Conversation } from './dm-api'
import './DmPage.css'

type Message = {
  id: number
  conversation_id: number
  sender_id: string | null
  body: string
  media: MediaItem[]
  created_at: string
  read_at: string | null
}

const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, body, media, created_at, read_at'
const MAX_DM_FILES = 4

export function DmChatPage() {
  const { id } = useParams()
  const conversationId = Number(id)
  const { profile, blockedIds } = useAuth()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [other, setOther] = useState<ProfileCard | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [signed, setSigned] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockedByOther, setBlockedByOther] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const myId = profile?.id

  const signFor = useCallback(async (list: Message[]) => {
    const paths = list.flatMap((m) => m.media.map((it) => it.path)).filter((p): p is string => !!p)
    if (paths.length === 0) return
    const map = await signDmMedia(paths)
    setSigned((prev) => ({ ...prev, ...map }))
  }, [])

  useEffect(() => {
    if (!myId || !conversationId) return
    let alive = true
    async function load(me: string) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, user_a, user_b, last_message_at, last_message_preview, last_sender_id')
        .eq('id', conversationId)
        .maybeSingle()
      if (!conv) {
        if (alive) setLoading(false)
        return
      }
      const c = conv as Conversation
      const [{ data: rows }, otherCard, otherBlockedMe] = await Promise.all([
        supabase
          .from('messages')
          .select(MESSAGE_COLUMNS)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(200),
        fetchProfileCard(otherUserOf(c, me)),
        isBlockedByUser(otherUserOf(c, me)),
      ])
      const list = ((rows ?? []) as Message[]).map((m) => ({ ...m, media: asMediaList(m.media) })).reverse()
      if (!alive) return
      setConversation(c)
      setOther(otherCard)
      setBlockedByOther(otherBlockedMe)
      setMessages(list)
      setLoading(false)
      await signFor(list)
      await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
      await markNotificationsReadByLink(`/dm/${conversationId}`)
    }
    load(myId)

    // 새 메시지·읽음 표시를 실시간으로 반영해요.
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const row = payload.new as Message
          if (!row?.id) return
          const msg = { ...row, media: asMediaList(row.media) }
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev.map((m) => (m.id === msg.id ? msg : m)) : [...prev, msg],
          )
          if (payload.eventType === 'INSERT') {
            await signFor([msg])
            if (msg.sender_id !== myId) await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
          }
        },
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [myId, conversationId, signFor])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  if (!FEATURES.dm) return <Navigate to="/feed" replace />
  if (!profile) return <Navigate to="/me" replace />

  const otherId = conversation ? otherUserOf(conversation, profile.id) : null
  const otherName = other?.nickname ?? UNKNOWN_NICKNAME
  const iBlocked = !!otherId && blockedIds.has(otherId)
  const lastMine = [...messages].reverse().find((m) => m.sender_id === profile.id)

  function pickFiles(list: FileList | null) {
    if (!list) return
    const picked = Array.from(list)
    const invalid = picked.map((f) => validateFile(f, { dm: true })).find(Boolean)
    if (invalid) setError(invalid)
    const ok = picked.filter((f) => !validateFile(f, { dm: true }))
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_DM_FILES))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function send() {
    if (!profile || sending || !conversation) return
    const text = draft.trim()
    if (!text && files.length === 0) return
    setSending(true)
    setError(null)
    try {
      const media = await Promise.all(files.map((f) => uploadDmMedia(conversation.id, profile.id, f)))
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({ conversation_id: conversation.id, sender_id: profile.id, body: text, media })
        .select(MESSAGE_COLUMNS)
        .single()
      if (insertError || !data) {
        // 대화 중에 상대방이 차단했다면 입력창 대신 안내를 보여줘요.
        if (otherId && (await isBlockedByUser(otherId))) {
          setBlockedByOther(true)
          throw new Error(DM_COPY.blockedByOther)
        }
        throw new Error(DM_COPY.sendError)
      }
      dispatchPush()
      const msg = { ...(data as Message), media: asMediaList(data.media) }
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      await signFor([msg])
      setDraft('')
      setFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : DM_COPY.sendError)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="dm-page dm-chat">
      <AppBar
        back="/dm"
        title={
          otherId ? (
            <ProfileLink userId={otherId} className="dm-chat__title">
              <Avatar name={otherName} seed={otherId} src={other?.avatar_url} size="xs" />
              {otherName}
            </ProfileLink>
          ) : (
            DM_COPY.title
          )
        }
        right={
          otherId ? (
            <MoreMenu isMine={false} authorId={otherId} authorName={otherName} report={{ type: 'user', id: otherId }} />
          ) : undefined
        }
      />

      {loading ? (
        <Loading />
      ) : !conversation ? (
        <div className="empty-state">
          <p>{DM_COPY.notFound}</p>
        </div>
      ) : (
        <>
          <p className="dm-safety">{DM_COPY.safety}</p>
          <ul className="chat-list">
            {messages.map((m) => {
              const mine = m.sender_id === profile.id
              return (
                <li key={m.id} className={`chat-row${mine ? ' chat-row--mine' : ''}`}>
                  {!mine && <Avatar name={otherName} seed={otherId} src={other?.avatar_url} size="sm" />}
                  <div className="chat-bubble-wrap">
                    <div className="chat-bubble">
                      {m.body && <p>{m.body}</p>}
                      <MediaGallery items={m.media} resolve={(it) => (it.path ? signed[it.path] : undefined)} compact />
                      <span className="chat-time">{formatRelativeTime(m.created_at)}</span>
                    </div>
                    {mine && lastMine?.id === m.id && m.read_at && <span className="chat-read">{DM_COPY.read}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
          <div ref={endRef} />
        </>
      )}

      {conversation && (
        <div className="bottom-bar">
          {iBlocked ? (
            <p className="dm-blocked">{DM_COPY.blocked}</p>
          ) : blockedByOther ? (
            <p className="dm-blocked">{DM_COPY.blockedByOther}</p>
          ) : (
            <div className="comment-composer">
              <AttachmentTray files={files} onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
              {error && <p className="error-text">{error}</p>}
              <form
                className="composer-bar dm-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
              >
                <button
                  type="button"
                  className="icon-button"
                  aria-label={DM_COPY.attach}
                  disabled={files.length >= MAX_DM_FILES}
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="image-icon" />
                </button>
                <input ref={fileRef} type="file" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
                <textarea
                  rows={1}
                  placeholder={DM_COPY.placeholder}
                  aria-label={DM_COPY.placeholder}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  type="submit"
                  className="circle-button circle-button--primary circle-button--sm"
                  aria-label={DM_COPY.send}
                  disabled={(!draft.trim() && files.length === 0) || sending}
                >
                  <Icon name="arrow-up-icon" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
