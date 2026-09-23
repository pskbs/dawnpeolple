import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditBox } from '../comments/CommentSection'
import { ExpandableText, MediaGallery } from '../../components/media'
import { MoreMenu } from '../../components/MoreMenu'
import { useToast } from '../../components/toast'
import { Avatar, Icon, ProfileLink } from '../../components/ui'
import { COMMENT_COPY, FEED_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { formatRelativeTime } from '../../lib/format'
import { removePublicMedia } from '../../lib/media'
import { UNKNOWN_NICKNAME, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { sharePath, type FeedPost } from './feed-api'

type Props = {
  post: FeedPost
  author: ProfileCard | undefined
  liked: boolean
  onLike: () => void
  onDeleted?: (postId: number) => void
  variant?: 'list' | 'detail'
}

const DOUBLE_TAP_MS = 260

// 스레드(Threads)식 게시물: 왼쪽 아바타, 이름·시간·더보기, 본문(500자 넘으면 더 보기), 첨부, 좋아요·답글·공유
export function PostItem({ post, author, liked, onLike, onDeleted, variant = 'list' }: Props) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const tapTimer = useRef<number | null>(null)
  const [burst, setBurst] = useState(0)
  const isDetail = variant === 'detail'
  const name = author?.nickname ?? UNKNOWN_NICKNAME
  const isMine = !!profile && post.author_id === profile.id
  const openThread = () => navigate(`/feed/${post.id}`)
  const [editing, setEditing] = useState(false)
  const [override, setOverride] = useState<{ body: string; edited_at: string } | null>(null)
  const body = override?.body ?? post.body
  const editedAt = override?.edited_at ?? post.edited_at

  // 인스타그램처럼 본문을 두 번 톡 치면 좋아요, 한 번이면 스레드로 이동해요.
  function handleBodyTap() {
    if (tapTimer.current !== null) {
      window.clearTimeout(tapTimer.current)
      tapTimer.current = null
      if (!liked) onLike()
      setBurst((n) => n + 1)
      return
    }
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null
      if (!isDetail) openThread()
    }, DOUBLE_TAP_MS)
  }

  async function handleDelete() {
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      toast.show(FEED_COPY.deleteError)
      return
    }
    void removePublicMedia(post.media)
    toast.show(FEED_COPY.deleted)
    onDeleted?.(post.id)
  }

  async function handleShare() {
    const result = await sharePath(`/feed/${post.id}`)
    if (result === 'copied') toast.show(FEED_COPY.shareCopied)
  }

  async function saveEdit(text: string) {
    const { data, error } = await supabase
      .from('posts')
      .update({ body: text })
      .eq('id', post.id)
      .select('body, edited_at')
      .single()
    if (error || !data) {
      toast.show(FEED_COPY.editError)
      return
    }
    setOverride({ body: data.body, edited_at: data.edited_at })
    setEditing(false)
  }

  return (
    <article className={`post${isDetail ? ' post--detail' : ''}`} data-testid="feed-post">
      <div className="post__rail">
        <ProfileLink userId={post.author_id} label={name}>
          <Avatar name={name} seed={post.author_id} src={author?.avatar_url} size="md" />
        </ProfileLink>
        {!isDetail && post.comment_count > 0 && <span className="post__line" />}
      </div>

      <div className="post__main">
        <header className="post__header">
          <ProfileLink userId={post.author_id} className="post__nickname">
            {name}
          </ProfileLink>
          <span className="post__time">
            {formatRelativeTime(post.created_at)}
            {editedAt && ` · ${COMMENT_COPY.edited}`}
          </span>
          <MoreMenu
            isMine={isMine}
            authorId={post.author_id}
            authorName={name}
            report={{ type: 'post', id: post.id }}
            onEdit={() => setEditing(true)}
            onDelete={handleDelete}
            deleteConfirm={FEED_COPY.deleteConfirm}
          />
        </header>

        {editing ? (
          <EditBox initial={body} onSave={saveEdit} onCancel={() => setEditing(false)} />
        ) : (
          body && (
            <div className="post__body" onClick={handleBodyTap} title={FEED_COPY.doubleTapHint}>
              <ExpandableText text={body} expandedByDefault={isDetail} />
              {burst > 0 && (
                <span key={burst} className="post__burst" aria-hidden="true">
                  <Icon name="heart-icon-filled" />
                </span>
              )}
            </div>
          )
        )}

        <MediaGallery items={post.media} />

        <div className="post__actions">
          <button
            type="button"
            className={`icon-action${liked ? ' icon-action--active' : ''}`}
            onClick={onLike}
            aria-label={FEED_COPY.like(post.like_count)}
            aria-pressed={liked}
          >
            <Icon name={liked ? 'heart-icon-filled' : 'heart-icon'} />
            <span className="icon-action__count">{post.like_count > 0 ? post.like_count : ''}</span>
          </button>
          <button
            type="button"
            className="icon-action"
            onClick={openThread}
            aria-label={FEED_COPY.replies(post.comment_count)}
          >
            <Icon name="chat-icon" />
            <span className="icon-action__count">{post.comment_count > 0 ? post.comment_count : ''}</span>
          </button>
          <button type="button" className="icon-action" onClick={handleShare} aria-label={FEED_COPY.share}>
            <Icon name="send-icon" />
          </button>
        </div>
      </div>
    </article>
  )
}
