import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// 뒤로가기: 앱 안에서 이동해 온 기록이 있으면 그 화면으로 돌아가고(history back),
// 링크로 바로 들어와 기록이 없을 때만 fallback 화면으로 가요.
// 예전처럼 navigate('/dm')로 "앞으로" 이동하면 기록이 쌓여 뒤로가기가 엉뚱한 화면으로 가요.
export function useGoBack(fallback = '/feed') {
  const navigate = useNavigate()
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, fallback])
}
