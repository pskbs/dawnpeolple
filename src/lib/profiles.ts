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

export const SIDO_OPTIONS = ['경기', '서울', '인천', '기타'] as const

export const WORK_TYPE_LABELS: Record<string, string> = Object.fromEntries(WORK_TYPE_OPTIONS)
export const OFF_TIME_LABELS: Record<string, string> = Object.fromEntries(OFF_TIME_OPTIONS)
export const GENDER_LABELS: Record<string, string> = { male: '남성', female: '여성' }

export const BIO_MAX = 150
