// 플랫폼 어댑터(CLAUDE.md 규칙 8) — 앱인토스 전용 코드는 ./toss/에만 두고, 나머지 코드는 이 파일을 거쳐요.
import { isTossAdSupported, showTossInterstitialAd } from './toss/ads'

// 글 작성·벙개 개설 완료 시 호출해요. 앱인토스 밖(웹)에서는 아무 일도 하지 않아요.
export function showCompletionAd() {
  if (!isTossAdSupported()) return
  try {
    showTossInterstitialAd()
  } catch {
    // 광고가 실패해도 사용자 흐름은 막지 않아요.
  }
}
