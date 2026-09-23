// 앱인토스 전용 코드(CLAUDE.md 규칙 8) — 여기서만 @apps-in-toss/web-framework를 직접 사용해요.
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework'

export type AdSlot = 'feed' | 'bungae'

// 메뉴별로 광고 그룹 ID가 달라요(수다방 글쓰기 완료 / 소모임 개설 완료).
// 없으면 테스트 ID로 동작해서 앱인토스 정책(실제 ID로 테스트 시 제재)을 어기지 않아요.
const AD_GROUP_IDS: Record<AdSlot, string> = {
  feed: import.meta.env.VITE_AD_INTERSTITIAL_FEED_ID || 'ait-ad-test-interstitial-id',
  bungae: import.meta.env.VITE_AD_INTERSTITIAL_BUNGAE_ID || 'ait-ad-test-interstitial-id',
}

// 같은 전면 광고를 너무 자주 보여주지 않도록 최소 간격을 둬요(빈도 제한).
const MIN_INTERVAL_MS = 5 * 60 * 1000
const LAST_SHOWN_KEY_PREFIX = 'dawnpeople:lastInterstitialAt:'

const loadedState: Record<AdSlot, boolean> = { feed: false, bungae: false }

function requestLoad(slot: AdSlot) {
  if (!loadFullScreenAd.isSupported()) return
  loadFullScreenAd({
    options: { adGroupId: AD_GROUP_IDS[slot] },
    onEvent: (event) => {
      if (event.type === 'loaded') loadedState[slot] = true
    },
    onError: () => {
      loadedState[slot] = false
    },
  })
}

export function isTossAdSupported() {
  return loadFullScreenAd.isSupported()
}

// 앱인토스 안에서 실행 중일 때만 의미 있어요. 미리 한 번씩 로드해 둬요.
requestLoad('feed')
requestLoad('bungae')

function withinFrequencyLimit(slot: AdSlot) {
  try {
    const key = LAST_SHOWN_KEY_PREFIX + slot
    const last = Number(localStorage.getItem(key) || 0)
    if (Date.now() - last < MIN_INTERVAL_MS) return false
    localStorage.setItem(key, String(Date.now()))
    return true
  } catch {
    // localStorage를 못 쓰는 환경이면 빈도 제한 없이 그냥 보여줘요.
    return true
  }
}

export function showTossInterstitialAd(slot: AdSlot) {
  if (!loadFullScreenAd.isSupported() || !loadedState[slot]) return
  if (!withinFrequencyLimit(slot)) return
  showFullScreenAd({
    options: { adGroupId: AD_GROUP_IDS[slot] },
    onEvent: (event) => {
      if (event.type === 'dismissed') {
        loadedState[slot] = false
        requestLoad(slot)
      }
    },
    onError: () => {
      loadedState[slot] = false
      requestLoad(slot)
    },
  })
}
