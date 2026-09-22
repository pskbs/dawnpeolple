// 앱인토스 전용 코드(CLAUDE.md 규칙 8) — 여기서만 @apps-in-toss/web-framework를 직접 사용해요.
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework'

// 실제 광고 단위 ID는 VITE_AD_INTERSTITIAL_ID로 채워요. 없으면 테스트 ID로 동작해서
// 앱인토스 정책(실제 ID로 테스트 시 제재)을 어기지 않아요.
const AD_GROUP_ID = import.meta.env.VITE_AD_INTERSTITIAL_ID || 'ait-ad-test-interstitial-id'

// 같은 전면 광고를 너무 자주 보여주지 않도록 최소 간격을 둬요(빈도 제한).
const MIN_INTERVAL_MS = 5 * 60 * 1000
const LAST_SHOWN_KEY = 'dawnpeople:lastInterstitialAt'

let adLoaded = false

function requestLoad() {
  if (!loadFullScreenAd.isSupported()) return
  loadFullScreenAd({
    options: { adGroupId: AD_GROUP_ID },
    onEvent: (event) => {
      if (event.type === 'loaded') adLoaded = true
    },
    onError: () => {
      adLoaded = false
    },
  })
}

export function isTossAdSupported() {
  return loadFullScreenAd.isSupported()
}

// 앱인토스 안에서 실행 중일 때만 의미 있어요. 미리 한 번 로드해 둬요.
requestLoad()

function withinFrequencyLimit() {
  try {
    const last = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0)
    if (Date.now() - last < MIN_INTERVAL_MS) return false
    localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()))
    return true
  } catch {
    // localStorage를 못 쓰는 환경이면 빈도 제한 없이 그냥 보여줘요.
    return true
  }
}

export function showTossInterstitialAd() {
  if (!loadFullScreenAd.isSupported() || !adLoaded) return
  if (!withinFrequencyLimit()) return
  showFullScreenAd({
    options: { adGroupId: AD_GROUP_ID },
    onEvent: (event) => {
      if (event.type === 'dismissed') {
        adLoaded = false
        requestLoad()
      }
    },
    onError: () => {
      adLoaded = false
      requestLoad()
    },
  })
}
