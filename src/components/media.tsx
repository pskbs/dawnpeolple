import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MEDIA_COPY } from '../config/copy'
import { formatBytes, mediaTypeOf, type MediaItem } from '../lib/media'
import { Icon } from './ui'

type Resolved = MediaItem & { src: string }

function resolveAll(items: MediaItem[], resolve?: (item: MediaItem) => string | undefined): Resolved[] {
  const out: Resolved[] = []
  for (const it of items) {
    const src = resolve ? resolve(it) : it.url
    if (src) out.push({ ...it, src })
  }
  return out
}

// 스레드처럼: 사진·영상 1개면 크게, 여러 개면 가로로 넘겨보는 줄, 파일은 아래에 칩으로.
export function MediaGallery({
  items,
  resolve,
  compact = false,
}: {
  items: MediaItem[]
  resolve?: (item: MediaItem) => string | undefined
  compact?: boolean
}) {
  const resolved = resolveAll(items, resolve)
  const visuals = resolved.filter((m) => m.type !== 'file')
  const files = resolved.filter((m) => m.type === 'file')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  if (resolved.length === 0) return null

  return (
    <div className={`media${compact ? ' media--compact' : ''}`} onClick={(e) => e.stopPropagation()}>
      {visuals.length === 1 && (
        <div className="media-single">
          <MediaVisual item={visuals[0]} onOpen={() => setViewerIndex(0)} />
        </div>
      )}
      {visuals.length > 1 && (
        <div className="media-strip" role="list">
          {visuals.map((m, i) => (
            <div key={m.src} className="media-strip__item" role="listitem">
              <MediaVisual item={m} onOpen={() => setViewerIndex(i)} />
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <ul className="media-files">
          {files.map((f) => (
            <li key={f.src}>
              <a className="file-chip" href={f.src} target="_blank" rel="noreferrer" download={f.name}>
                <Icon name="file-icon" />
                <span className="file-chip__name">{f.name ?? MEDIA_COPY.file}</span>
                {f.size ? <span className="file-chip__size">{formatBytes(f.size)}</span> : null}
                <Icon name="download-icon" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {viewerIndex !== null && (
        <MediaViewer items={visuals} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </div>
  )
}

function MediaVisual({ item, onOpen }: { item: Resolved; onOpen: () => void }) {
  if (item.type === 'video') {
    return <video className="media-el" src={item.src} controls playsInline preload="metadata" />
  }
  return (
    <button type="button" className="media-button" onClick={onOpen} aria-label={MEDIA_COPY.openImage}>
      <img className="media-el" src={item.src} alt="" loading="lazy" />
    </button>
  )
}

function MediaViewer({ items, startIndex, onClose }: { items: Resolved[]; startIndex: number; onClose: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(startIndex)

  useEffect(() => {
    const track = trackRef.current
    if (track) track.scrollLeft = track.clientWidth * startIndex
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [startIndex, onClose])

  function onScroll() {
    const track = trackRef.current
    if (track) setIndex(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)))
  }

  return createPortal(
    <div className="media-viewer" role="dialog" aria-modal="true">
      <div className="media-viewer__bar">
        <span>{items.length > 1 ? `${index + 1} / ${items.length}` : ''}</span>
        <button type="button" className="circle-button circle-button--sm" aria-label="닫기" onClick={onClose}>
          <Icon name="close-icon" />
        </button>
      </div>
      <div className="media-viewer__track" ref={trackRef} onScroll={onScroll}>
        {items.map((m) => (
          <div key={m.src} className="media-viewer__slide">
            {m.type === 'video' ? (
              <video src={m.src} controls playsInline />
            ) : (
              <img src={m.src} alt="" />
            )}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}

// 올리기 전 첨부 미리보기(작성 화면·댓글·DM 공용)
export function AttachmentTray({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  if (files.length === 0) return null
  return (
    <ul className="attach-tray">
      {files.map((file, i) => {
        const type = mediaTypeOf(file)
        return (
          <li key={urls[i]} className={`attach-tray__item attach-tray__item--${type}`}>
            {type === 'image' && <img src={urls[i]} alt="" />}
            {type === 'video' && (
              <>
                <video src={urls[i]} muted playsInline preload="metadata" />
                <span className="attach-tray__play">
                  <Icon name="play-icon" />
                </span>
              </>
            )}
            {type === 'file' && (
              <span className="attach-tray__file">
                <Icon name="file-icon" />
                <span>{file.name}</span>
                <small>{formatBytes(file.size)}</small>
              </span>
            )}
            <button
              type="button"
              className="attach-tray__remove"
              aria-label={MEDIA_COPY.remove}
              onClick={() => onRemove(i)}
            >
              <Icon name="close-icon" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// 다른 사람이 볼 때 긴 글은 접어두고 "더 보기"로 펼쳐요.
export const TRUNCATE_AT = 500

export function ExpandableText({ text, className, expandedByDefault = false }: { text: string; className?: string; expandedByDefault?: boolean }) {
  const [expanded, setExpanded] = useState(expandedByDefault)
  if (!text) return null
  const long = text.length > TRUNCATE_AT
  const shown = long && !expanded ? `${text.slice(0, TRUNCATE_AT).trimEnd()}…` : text
  return (
    <p className={className}>
      {shown}
      {long && (
        <button
          type="button"
          className="read-more"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
        >
          {expanded ? MEDIA_COPY.readLess : MEDIA_COPY.readMore}
        </button>
      )}
    </p>
  )
}
