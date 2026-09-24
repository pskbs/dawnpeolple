// 앱인토스 전용 코드(CLAUDE.md 규칙 8) — 여기서만 @apps-in-toss/web-framework를 직접 사용해요.
import { TossAds } from '@apps-in-toss/web-framework'

// --- 배너(수다방 글 상세 — 댓글 위 / 소모임 상세 — 참석 영역 위) ---
// 화면마다 배너 그룹 ID가 달라요. 없으면 테스트 ID로 동작해서 앱인토스 정책(실제 ID로 테스트 시 제재)을 어기지 않아요.
export type BannerSlot = 'feed' | 'bungae'

const BANNER_AD_GROUP_IDS: Record<BannerSlot, string> = {
  feed: import.meta.env.VITE_AD_BANNER_FEED_ID || 'ait-ad-test-banner-id',
  bungae: import.meta.env.VITE_AD_BANNER_BUNGAE_ID || 'ait-ad-test-banner-id',
}

let bannerInitState: 'idle' | 'pending' | 'ready' | 'failed' = 'idle'
let bannerInitWaiters: Array<() => void> = []

function ensureBannerInitialized(): Promise<void> {
  if (bannerInitState === 'ready') return Promise.resolve()
  return new Promise((resolve) => {
    bannerInitWaiters.push(resolve)
    if (bannerInitState === 'pending') return
    bannerInitState = 'pending'
    TossAds.initialize({
      callbacks: {
        onInitialized: () => {
          bannerInitState = 'ready'
          bannerInitWaiters.forEach((w) => w())
          bannerInitWaiters = []
        },
        onInitializationFailed: () => {
          bannerInitState = 'failed'
          bannerInitWaiters.forEach((w) => w())
          bannerInitWaiters = []
        },
      },
    })
  })
}

export function isTossBannerSupported() {
  return TossAds.attachBanner.isSupported()
}

// 언마운트 시 호출할 정리 함수를 반환해요. 초기화 전에 언마운트되면 아무 것도 붙이지 않아요.
export function attachTossBanner(target: HTMLElement, slot: BannerSlot): () => void {
  if (!isTossBannerSupported()) return () => {}
  let unmounted = false
  let attached: { destroy: () => void } | null = null
  ensureBannerInitialized().then(() => {
    if (unmounted || bannerInitState !== 'ready') return
    attached = TossAds.attachBanner(BANNER_AD_GROUP_IDS[slot], target, { theme: 'auto' })
  })
  return () => {
    unmounted = true
    attached?.destroy()
  }
}
