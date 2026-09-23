import { useNavigate } from 'react-router-dom'
import { Icon, Loading } from '../../components/ui'
import { NOTIFICATION_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { formatRelativeTime } from '../../lib/format'
import { NOTIFICATION_TYPE_ICONS, useNotifications } from './notifications-api'
import './Notifications.css'

// 앱 안 알림 목록. 푸시와 같은 내용이 남고, 누르면 해당 글·대화방·소모임으로 이동해요.
export function NotificationList() {
  const { items, loading, markRead, markAllRead } = useNotifications()
  const { blockedIds } = useAuth()
  const navigate = useNavigate()

  if (loading) return <Loading />

  const visible = items.filter((n) => !n.actor_id || !blockedIds.has(n.actor_id))

  if (visible.length === 0) {
    return (
      <div className="empty-state">
        <span className="orb orb--md" aria-hidden="true" />
        <p>{NOTIFICATION_COPY.empty}</p>
        <p className="muted">{NOTIFICATION_COPY.emptyHint}</p>
      </div>
    )
  }

  const hasUnread = visible.some((n) => !n.read_at)

  return (
    <div className="notification-list-wrap">
      {hasUnread && (
        <button type="button" className="notification-list__mark-all" onClick={markAllRead}>
          {NOTIFICATION_COPY.markAllRead}
        </button>
      )}
      <ul className="sheet list-rows notification-list" data-testid="notification-list">
        {visible.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className={`notification-row${n.read_at ? '' : ' notification-row--unread'}`}
              onClick={() => {
                void markRead(n.id)
                navigate(n.link)
              }}
            >
              <span className="notification-row__icon" aria-hidden="true">
                <Icon name={NOTIFICATION_TYPE_ICONS[n.type]} />
              </span>
              <span className="notification-row__text">
                <span className="notification-row__title">{n.title}</span>
                <span className="notification-row__body">{n.body}</span>
                <span className="notification-row__time">{formatRelativeTime(n.created_at)}</span>
              </span>
              {!n.read_at && <span className="notification-row__dot" aria-label="안 읽음" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
