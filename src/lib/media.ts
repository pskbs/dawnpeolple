import { supabase } from './supabase'

export type MediaType = 'image' | 'video' | 'file'

// 글·댓글·프로필 첨부(공개 버킷 media)는 url, DM 첨부(비공개 버킷 dm-media)는 path를 저장해요.
export type MediaItem = {
  type: MediaType
  url?: string
  path?: string
  name?: string
  size?: number
  mime?: string
}

export const MEDIA_BUCKET = 'media'
export const DM_MEDIA_BUCKET = 'dm-media'

export const MEDIA_LIMITS = {
  maxCount: 10,
  imageBytes: 10 * 1024 * 1024,
  videoBytes: 50 * 1024 * 1024,
  fileBytes: 20 * 1024 * 1024,
  dmBytes: 20 * 1024 * 1024,
} as const

export function mediaTypeOf(file: File): MediaType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return 'file'
}

function limitFor(type: MediaType) {
  if (type === 'image') return MEDIA_LIMITS.imageBytes
  if (type === 'video') return MEDIA_LIMITS.videoBytes
  return MEDIA_LIMITS.fileBytes
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// 올릴 수 없는 파일이면 이유(해요체)를, 괜찮으면 null을 돌려줘요.
export function validateFile(file: File, { dm = false } = {}): string | null {
  const type = mediaTypeOf(file)
  const limit = dm ? MEDIA_LIMITS.dmBytes : limitFor(type)
  if (file.size > limit) return `${file.name}: ${formatBytes(limit)} 이하 파일만 올릴 수 있어요.`
  return null
}

function extensionOf(file: File) {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : ''
  return (fromName || file.type.split('/').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
}

async function uploadTo(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error('파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요.')
}

// 공개 버킷: "{userId}/{uuid}.{ext}"
export async function uploadPublicMedia(userId: string, file: File): Promise<MediaItem> {
  const path = `${userId}/${crypto.randomUUID()}.${extensionOf(file)}`
  await uploadTo(MEDIA_BUCKET, path, file)
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return { type: mediaTypeOf(file), url: data.publicUrl, name: file.name, size: file.size, mime: file.type }
}

export async function uploadPublicMediaList(userId: string, files: File[]): Promise<MediaItem[]> {
  return Promise.all(files.map((f) => uploadPublicMedia(userId, f)))
}

// 비공개 DM 버킷: "{conversationId}/{senderId}/{uuid}.{ext}"
export async function uploadDmMedia(conversationId: number, userId: string, file: File): Promise<MediaItem> {
  const path = `${conversationId}/${userId}/${crypto.randomUUID()}.${extensionOf(file)}`
  await uploadTo(DM_MEDIA_BUCKET, path, file)
  return { type: mediaTypeOf(file), path, name: file.name, size: file.size, mime: file.type }
}

export async function signDmMedia(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data } = await supabase.storage.from(DM_MEDIA_BUCKET).createSignedUrls(paths, 60 * 60)
  const map: Record<string, string> = {}
  for (const row of data ?? []) if (row.path && row.signedUrl) map[row.path] = row.signedUrl
  return map
}

// 공개 URL에서 버킷 내부 경로를 꺼내요(삭제용).
function publicPathOf(url: string) {
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`
  const i = url.indexOf(marker)
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null
}

// 실패해도 화면 흐름은 막지 않아요(남은 파일은 탈퇴 시 폴더째 정리).
export async function removePublicMedia(items: MediaItem[] | string[]) {
  const paths = items
    .map((it) => (typeof it === 'string' ? it : it.url))
    .map((u) => (u ? publicPathOf(u) : null))
    .filter((p): p is string => !!p)
  if (paths.length > 0) await supabase.storage.from(MEDIA_BUCKET).remove(paths)
}

async function listAll(bucket: string, folder: string): Promise<string[]> {
  const { data } = await supabase.storage.from(bucket).list(folder, { limit: 1000 })
  const out: string[] = []
  for (const entry of data ?? []) {
    const full = `${folder}/${entry.name}`
    // id가 없으면 하위 폴더예요.
    if (entry.id) out.push(full)
    else out.push(...(await listAll(bucket, full)))
  }
  return out
}

// 회원탈퇴 전: 내 공개 폴더와 내가 속한 대화방 폴더의 파일을 지워요.
export async function purgeMyStorage(userId: string, conversationIds: number[]) {
  const mine = await listAll(MEDIA_BUCKET, userId)
  if (mine.length > 0) await supabase.storage.from(MEDIA_BUCKET).remove(mine)
  for (const id of conversationIds) {
    const files = await listAll(DM_MEDIA_BUCKET, String(id))
    if (files.length > 0) await supabase.storage.from(DM_MEDIA_BUCKET).remove(files)
  }
}

export function asMediaList(value: unknown): MediaItem[] {
  return Array.isArray(value) ? (value as MediaItem[]) : []
}
