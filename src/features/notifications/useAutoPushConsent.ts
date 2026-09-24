import { useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import { isPushConsentAvailable, requestPushConsent } from '../../platform'
import { NOTIFICATION_TYPES } from './notifications-api'

const ASKED_KEY_PREFIX = 'dawnpeople:pushConsentAsked:'

// 토스 안에서 가입(온보딩)을 마친 사용자에게 푸시 동의 화면을 계정당 한 번만 자동으로 띄워요.
// 안 받고 넘어가도 알림 설정의 "푸시 알림 받기"에서 언제든 다시 요청할 수 있어요.
export function useAutoPushConsent() {
  const { profile } = useAuth()
  const userId = profile?.id

  useEffect(() => {
    if (!userId || !isPushConsentAvailable()) return
    const key = ASKED_KEY_PREFIX + userId
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      // 저장이 막힌 환경이면 자동 요청은 건너뛰어요(설정 화면 버튼은 그대로 써요).
      return
    }
    void requestPushConsent(NOTIFICATION_TYPES)
  }, [userId])
}
