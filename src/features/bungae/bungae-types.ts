export type Bungae = {
  id: number
  host_id: string
  title: string
  body: string
  starts_at: string
  sido: string
  sigungu: string
  eupmyeondong: string | null
  place_hint: string | null
  capacity: number
  status: string
  created_at: string
}

export const BUNGAE_COLUMNS =
  'id, host_id, title, body, starts_at, sido, sigungu, eupmyeondong, place_hint, capacity, status, created_at'

// 새벽에 일하는 사람들 기준 기본 모임 시각: 새벽 6시(오전 6시)
export const DEFAULT_MEET_HOUR = 6
const MIN_HOURS_AHEAD = 1

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function toDatetimeLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 가장 가까운 "개설 가능한" 새벽 6시(지금부터 1시간 이후)
export function defaultStartsAt(now = new Date()) {
  const candidate = new Date(now)
  candidate.setHours(DEFAULT_MEET_HOUR, 0, 0, 0)
  if (candidate.getTime() < now.getTime() + MIN_HOURS_AHEAD * 60 * 60 * 1000) {
    candidate.setDate(candidate.getDate() + 1)
  }
  return toDatetimeLocal(candidate)
}

export function dateTileParts(iso: string) {
  const d = new Date(iso)
  return {
    day: `${d.getMonth() + 1}/${d.getDate()}`,
    weekday: d.toLocaleDateString('ko-KR', { weekday: 'short' }),
    time: d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }),
  }
}

export function storyTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function storyDay(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
