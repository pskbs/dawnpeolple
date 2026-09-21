import { NavLink } from 'react-router-dom'
import { TAB_LABELS } from '../config/copy'
import './TabBar.css'

// 웹 전용 임시 탭바입니다. 앱인토스 빌드에서는 반드시 TDS 플로팅 탭바로 교체해야 해요(커스텀 탭바 금지).
const TABS = [
  { to: '/feed', label: TAB_LABELS.feed, icon: 'chat-icon' },
  { to: '/bungae', label: TAB_LABELS.bungae, icon: 'group-icon' },
  { to: '/me', label: TAB_LABELS.me, icon: 'user-icon' },
] as const

export function TabBar() {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `tab-bar__item${isActive ? ' tab-bar__item--active' : ''}`}
          aria-label={tab.label}
        >
          <span className="tab-bar__badge">
            <svg className="tab-bar__icon" width="20" height="20" aria-hidden="true">
              <use href={`/icons.svg#${tab.icon}`} />
            </svg>
          </span>
          <span className="tab-bar__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
