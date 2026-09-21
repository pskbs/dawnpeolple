export type Bungae = {
  id: number
  host_id: string
  title: string
  body: string
  starts_at: string
  region_code: string
  place_hint: string | null
  capacity: number
  status: string
  created_at: string
}

export function formatStartsAt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function dateTileParts(iso: string) {
  const d = new Date(iso)
  return {
    day: `${d.getMonth() + 1}/${d.getDate()}`,
    weekday: d.toLocaleDateString('ko-KR', { weekday: 'short' }),
    time: d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }),
  }
}
