import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon } from '../../components/ui'
import { FEED_COPY } from '../../config/copy'
import { formatRelativeTime } from '../../lib/format'
import type { FeedPost } from './feed-api'

type Props = {
  post: FeedPost
  nickname: string
  liked: boolean
  onLike: () => void
  variant?: 'list' | 'detail'
}

const DOUBLE_TAP_MS = 260

export function PostItem({ post, nickname, liked, onLike, variant = 'list' }: Props) {
  const navigate = useNavigate()
  const tapTimer = useRef<number | null>(null)
  const [burst, setBurst] = useState(0)
  const isDetail = variant === 'detail'
  const openThread = () => navigate(`/feed/${post.id}`)

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

  return (
    <article className={`post${isDetail ? ' post--detail' : ''}`} data-testid="feed-post">
      <div className="post__rail">
        <Avatar name={nickname} seed={post.author_id} size="md" />
        {!isDetail && post.comment_count > 0 && <span className="post__line" />}
      </div>

      <div className="post__main">
        <header className="post__header">
          <span className="post__nickname">{nickname}</span>
          <span className="post__time">{formatRelativeTime(post.created_at)}</span>
        </header>

        <div className="post__body" onClick={handleBodyTap} title={FEED_COPY.doubleTapHint}>
          <p>{post.body}</p>
          {burst > 0 && (
            <span key={burst} className="post__burst" aria-hidden="true">
              <Icon name="heart-icon-filled" />
            </span>
          )}
        </div>

        <div className="post__actions">
          <button
            type="button"
            className={`icon-action${liked ? ' icon-action--active' : ''}`}
            onClick={onLike}
            aria-label={`좋아요 ${post.like_count}`}
            aria-pressed={liked}
          >
            <Icon name={liked ? 'heart-icon-filled' : 'heart-icon'} />
            <span className="icon-action__count">{post.like_count > 0 ? post.like_count : ''}</span>
          </button>
          <button
            type="button"
            className="icon-action"
            onClick={openThread}
            aria-label={`댓글 ${post.comment_count}`}
          >
            <Icon name="chat-icon" />
            <span className="icon-action__count">{post.comment_count > 0 ? post.comment_count : ''}</span>
          </button>
        </div>

        {!isDetail && post.comment_count > 0 && (
          <button type="button" className="post__replies-link" onClick={openThread}>
            {FEED_COPY.viewReplies(post.comment_count)}
          </button>
        )}
      </div>
    </article>
  )
}
