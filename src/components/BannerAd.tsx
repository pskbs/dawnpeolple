import { useEffect, useRef } from 'react'
import { attachBannerAd, isBannerAdSupported } from '../platform'

// 글·벙개 상세 화면 하단에 붙이는 배너 광고예요. 앱인토스 밖(웹)에서는 렌더링 안 해요.
export function BannerAd() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    return attachBannerAd(ref.current)
  }, [])

  if (!isBannerAdSupported()) return null
  return <div ref={ref} className="banner-ad" aria-hidden="true" />
}
