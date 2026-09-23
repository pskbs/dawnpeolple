import { useToast } from '../../components/toast'
import { Icon } from '../../components/ui'
import { NOTIFICATION_COPY } from '../../config/copy'
import { NOTIFICATION_TYPE_ICONS, NOTIFICATION_TYPES, useNotificationSettings } from './notifications-api'
import './Notifications.css'

// 종류별 알림 켜기/끄기. 내정보 설정과 메시지 화면에서 같은 컴포넌트를 써요.
export function NotificationSettingsSection() {
  const { settings, loaded, update } = useNotificationSettings()
  const toast = useToast()

  return (
    <div className="notification-settings">
      <div className="sheet list-rows">
        {NOTIFICATION_TYPES.map((type) => {
          const copy = NOTIFICATION_COPY.types[type]
          return (
            <label key={type} className="list-row notification-settings__row">
              <Icon name={NOTIFICATION_TYPE_ICONS[type]} />
              <span className="notification-settings__text">
                <span className="list-row__label">{copy.label}</span>
                <span className="notification-settings__desc">{copy.desc}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="switch"
                checked={settings[type]}
                disabled={!loaded}
                aria-label={copy.label}
                onChange={async (e) => {
                  const ok = await update(type, e.target.checked)
                  if (ok === false) toast.show(NOTIFICATION_COPY.saveError)
                }}
              />
            </label>
          )
        })}
      </div>
      <p className="notification-settings__note">{NOTIFICATION_COPY.settingsDesc}</p>
      <p className="notification-settings__note">{NOTIFICATION_COPY.tossNote}</p>
    </div>
  )
}
