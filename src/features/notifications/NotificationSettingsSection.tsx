import { useToast } from '../../components/toast'
import { Icon } from '../../components/ui'
import { NOTIFICATION_COPY } from '../../config/copy'
import { isPushConsentAvailable, requestPushConsent } from '../../platform'
import { useState } from 'react'
import { NOTIFICATION_TYPE_ICONS, NOTIFICATION_TYPES, useNotificationSettings } from './notifications-api'
import type { NotificationType } from './notifications-api'
import './Notifications.css'

// 종류별 알림 켜기/끄기. 내정보 설정과 메시지 화면에서 같은 컴포넌트를 써요.
export function NotificationSettingsSection() {
  const { settings, loaded, update } = useNotificationSettings()
  const toast = useToast()
  const pushAvailable = isPushConsentAvailable()
  const [asking, setAsking] = useState(false)

  // 토스 푸시는 캠페인마다 동의가 필요해요. 이미 동의했거나 같은 캠페인인 종류는 화면 없이 넘어가요.
  async function askPushConsent(types: NotificationType[]) {
    setAsking(true)
    const results = await requestPushConsent(types)
    const failed = results.includes('failed')
    const rejected = results.includes('agreementRejected')
    setAsking(false)
    toast.show(failed ? NOTIFICATION_COPY.pushFailed : rejected ? NOTIFICATION_COPY.pushRejected : NOTIFICATION_COPY.pushDone)
  }

  return (
    <div className="notification-settings">
      {pushAvailable && (
        <div className="sheet notification-push">
          <div className="notification-push__text">
            <span className="list-row__label">{NOTIFICATION_COPY.pushTitle}</span>
            <span className="notification-settings__desc">{NOTIFICATION_COPY.pushDesc}</span>
          </div>
          <button
            type="button"
            className="pill-button pill-button--sm"
            disabled={!loaded || asking}
            onClick={() => askPushConsent(NOTIFICATION_TYPES.filter((type) => settings[type]))}
          >
            {NOTIFICATION_COPY.pushButton}
          </button>
        </div>
      )}
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
                  if (ok === false) {
                    toast.show(NOTIFICATION_COPY.saveError)
                    return
                  }
                  if (e.target.checked && pushAvailable) void askPushConsent([type])
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
