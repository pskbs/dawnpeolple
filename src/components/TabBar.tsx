import { Link, NavLink, useLocation } from 'react-router-dom'
import { BUNGAE_COPY, FAB_COPY, TAB_LABELS } from '../config/copy'
import { useAuth } from '../lib/auth-context'
import { Icon } from './ui'
import './TabBar.css'

// 웹 전용 임시 탭바입니다. 앱인토스 빌드에서는 반드시 TDS 플로팅 탭바로 교체해야 해요(커스텀 탭바 금지).
const TABS = [
  { to: '/feed', label: TAB_LABELS.feed, icon: 'chat-icon' },
  { to: '/bungae', label: TAB_LABELS.bungae, icon: 'group-icon' },
  { to: '/me', label: TAB_LABELS.me, icon: 'user-icon' },
] as const

export function TabBar() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const onBungae = pathname.startsWith('/bungae')
  const createTo = !profile ? '/me' : onBungae ? '/bungae/new' : '/feed/new'
  const createLabel = onBungae ? BUNGAE_COPY.fabLabel : FAB_COPY.post

  return (
    <div className="tab-dock">
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `tab-bar__item${isActive ? ' tab-bar__item--active' : ''}`}
            aria-label={tab.label}
          >
            <Icon name={tab.icon} className="tab-bar__icon" />
            <span className="tab-bar__label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
      <Link to={createTo} className="tab-fab" aria-label={createLabel}>
        <Icon name="plus-icon" />
      </Link>
    </div>
  )
}
