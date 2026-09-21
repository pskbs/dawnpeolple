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
