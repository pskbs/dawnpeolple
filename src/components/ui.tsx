import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`/icons.svg#${name}`} />
    </svg>
  )
}

function toneOf(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return String(Math.abs(h) % 4)
}

export function Avatar({
  name,
  seed,
  size = 'md',
}: {
  name: string
  seed?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  return (
    <span className={`avatar avatar--${size}`} data-tone={toneOf(seed ?? name)} aria-hidden="true">
      {name.charAt(0)}
    </span>
  )
}

export function AppBar({
  title,
  back,
  left,
  right,
}: {
  title?: ReactNode
  back?: string | true
  left?: ReactNode
  right?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="app-bar">
      {back ? (
        <button
          type="button"
          className="circle-button"
          aria-label="뒤로"
          onClick={() => (back === true ? navigate(-1) : navigate(back))}
        >
          <Icon name="arrow-left-icon" />
        </button>
      ) : (
        (left ?? <span className="app-bar__spacer" />)
      )}
      {title && <h1 className="app-bar__title">{title}</h1>}
      {right ?? <span className="app-bar__spacer" />}
    </header>
  )
}

export function Loading() {
  return (
    <div className="loading-dots" role="status" aria-label="불러오는 중">
      <span />
      <span />
      <span />
    </div>
  )
}
