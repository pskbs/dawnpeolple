import { Link } from 'react-router-dom'
import { DM_COPY } from '../config/copy'
import { FEATURES } from '../config/features'
import { useAuth } from '../lib/auth-context'
import { useUnreadCount } from '../features/dm/dm-api'
import { useUnreadNotificationCount } from '../features/notifications/notifications-api'
import { Icon } from './ui'

// 상단 오른쪽 메시지(DM) 버튼 + 안 읽은 메시지·알림 수 배지
export function DmButton() {
  const { profile } = useAuth()
  const unread = useUnreadCount() + useUnreadNotificationCount()
  if (!FEATURES.dm || !profile) return null
  return (
    <Link to="/dm" className="icon-button icon-button--dark" aria-label={DM_COPY.title}>
      <Icon name="send-icon" />
      {unread > 0 && <span className="icon-button__badge">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  )
}
