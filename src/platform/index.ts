// 플랫폼 어댑터(CLAUDE.md 규칙 8) — 앱인토스 전용 코드는 ./toss/에만 두고, 나머지 코드는 이 파일을 거쳐요.
import type { AdSlot, BannerSlot } from './toss/ads'
import { attachTossBanner, isTossAdSupported, isTossBannerSupported, showTossInterstitialAd } from './toss/ads'

export type { BannerSlot }
import { isTossLoginSupported, signInWithToss } from './toss/login'
import type { PushConsentResult, PushTemplateKey } from './toss/push-consent'
import { isTossPushConsentSupported, requestTossPushAgreements } from './toss/push-consent'
import { isTossShareSupported, shareTossPath } from './toss/share'

export type { PushConsentResult, PushTemplateKey }

// 토스 푸시 알림 동의(알림동의문). 앱인토스 밖(웹)에서는 푸시가 없어서 지원하지 않아요.
export function isPushConsentAvailable() {
  return isTossPushConsentSupported()
}

export function requestPushConsent(keys: PushTemplateKey[]): Promise<PushConsentResult[]> {
  return requestTossPushAgreements(keys)
}

// 글 작성·벙개 개설 완료 시 호출해요. 앱인토스 밖(웹)에서는 아무 일도 하지 않아요.
export function showCompletionAd(slot: AdSlot) {
  if (!isTossAdSupported()) return
  try {
    showTossInterstitialAd(slot)
  } catch {
    // 광고가 실패해도 사용자 흐름은 막지 않아요.
  }
}

// 수다방 글 상세(댓글 위)·소모임 상세(참석 영역 위) 배너. 앱인토스 밖(웹)에서는 아무 것도 붙이지 않아요.
export function isBannerAdSupported() {
  return isTossBannerSupported()
}

// 반환하는 함수를 호출하면 배너를 정리해요(컴포넌트 언마운트 시).
export function attachBannerAd(target: HTMLElement, slot: BannerSlot): () => void {
  try {
    return attachTossBanner(target, slot)
  } catch {
    return () => {}
  }
}

// 앱인토스 미니앱에서는 로그인 수단이 토스 로그인 하나뿐이에요(대체 로그인 수단 금지).
export function isTossLoginAvailable() {
  return isTossLoginSupported()
}

export function loginWithToss() {
  return signInWithToss()
}

// 글·소모임·프로필 공유. 앱인토스 안에서는 intoss:// 딥링크를, 웹에서는 일반 URL을 공유해요.
export async function shareAppPath(path: string): Promise<'shared' | 'copied' | 'failed'> {
  if (isTossShareSupported()) {
    try {
      await shareTossPath(path)
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  const url = `${window.location.origin}${path}`
  try {
    if (navigator.share) {
      await navigator.share({ url })
      return 'shared'
    }
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
