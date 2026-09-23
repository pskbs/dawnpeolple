import { useEffect, useRef } from 'react'
import { attachBannerAd, isBannerAdSupported, type BannerSlot } from '../platform'

// 수다방 글 상세(댓글 위)·소모임 상세(참석 영역 위)에 붙이는 배너 광고예요. 앱인토스 밖(웹)에서는 렌더링 안 해요.
export function BannerAd({ slot }: { slot: BannerSlot }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    return attachBannerAd(ref.current, slot)
  }, [slot])

  if (!isBannerAdSupported()) return null
  return <div ref={ref} className="banner-ad" aria-hidden="true" />
}
