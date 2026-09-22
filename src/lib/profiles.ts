import { SIDO_LIST, SIGUNGU_BY_SIDO, type Sido } from '../config/regions'
import { supabase } from './supabase'

// 다른 사용자에게 보여도 되는 최소 정보(profile_cards 뷰). 성별·출생연도는 없어요.
export type ProfileCard = {
  id: string
  nickname: string
  work_type: string | null
  show_work_badge: boolean
  avatar_url: string | null
  bio: string | null
}

export const PROFILE_CARD_COLUMNS = 'id, nickname, work_type, show_work_badge, avatar_url, bio'

export const UNKNOWN_NICKNAME = '알 수 없음'

export async function fetchProfileCards(ids: (string | null | undefined)[]): Promise<Record<string, ProfileCard>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  if (unique.length === 0) return {}
  const { data } = await supabase.from('profile_cards').select(PROFILE_CARD_COLUMNS).in('id', unique)
  const map: Record<string, ProfileCard> = {}
  for (const card of (data ?? []) as ProfileCard[]) map[card.id] = card
  return map
}

export async function fetchProfileCard(id: string): Promise<ProfileCard | null> {
  const { data } = await supabase.from('profile_cards').select(PROFILE_CARD_COLUMNS).eq('id', id).maybeSingle()
  return (data as ProfileCard | null) ?? null
}

export const WORK_TYPE_OPTIONS = [
  ['nursing', '간호·의료'],
  ['business', '사장님·자영업'],
  ['service', '서비스·판매'],
  ['manufacturing', '제조·물류 교대'],
  ['freelance', '프리랜서·크리에이터'],
  ['etc', '기타'],
] as const

export const OFF_TIME_OPTIONS = [
  ['midnight', '밤 12~3시'],
  ['dawn', '새벽 3~6시'],
  ['morning', '아침 6~9시'],
  ['irregular', '불규칙'],
] as const

// 2026-09-22: 경기/서울/인천/기타 4개 축소판에서 전국 시/도로 확장(docs/decisions.md 참고)
export const SIDO_OPTIONS = SIDO_LIST

export function sigunguOptionsFor(sido: string): readonly string[] {
  return SIGUNGU_BY_SIDO[sido as Sido] ?? []
}

export const WORK_TYPE_LABELS: Record<string, string> = Object.fromEntries(WORK_TYPE_OPTIONS)
export const OFF_TIME_LABELS: Record<string, string> = Object.fromEntries(OFF_TIME_OPTIONS)
export const GENDER_LABELS: Record<string, string> = { male: '남성', female: '여성' }

export const BIO_MAX = 150

// 즐겨찾는 동네(당근마켓 "동네 설정"과 비슷한 개념). 최대 3개, 이름을 붙일 수 있어요(집/회사/직접 입력).
export type SavedLocation = {
  id: string
  label: string
  sido: string
  sigungu: string
}

export const MAX_SAVED_LOCATIONS = 3
export const LOCATION_LABEL_PRESETS = ['집', '회사'] as const

export function parseSavedLocations(value: unknown): SavedLocation[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (v): v is SavedLocation =>
      !!v && typeof v === 'object' && typeof (v as SavedLocation).id === 'string' && typeof (v as SavedLocation).sigungu === 'string',
  )
}

// 지역 근접도 순위: 같은 시/군/구(+동/읍/면 일치 시 더 우선) > 같은 시/도 > 그 외.
// 실거리 계산 대신 행정구역 계층으로 근사해요(위경도 데이터 없음).
export function regionRank(
  target: { sido: string; sigungu: string; eupmyeondong?: string | null },
  ref: { sido: string; sigungu: string; eupmyeondong?: string | null } | null,
): number {
  if (!ref) return 2
  if (target.sido !== ref.sido) return 2
  if (target.sigungu !== ref.sigungu) return 1
  if (ref.eupmyeondong && target.eupmyeondong && ref.eupmyeondong === target.eupmyeondong) return -1
  return 0
}
