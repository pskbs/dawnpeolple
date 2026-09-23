import { apiUrl } from './apiBase'
import { supabase } from './supabase'

// 댓글·메시지·소모임 참가 직후 호출해요. 알림 행은 DB 트리거가 이미 만들었고, 서버는 그걸 읽어 토스 푸시만 보내요.
// 실패해도 사용자 흐름은 막지 않아요(앱 안 알림은 이미 남아 있음).
export function dispatchPush() {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      await fetch(apiUrl('/api/push/dispatch'), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        keepalive: true,
      })
    } catch {
      // 무시
    }
  })()
}
