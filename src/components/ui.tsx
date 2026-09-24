import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useGoBack } from '../lib/use-go-back'
import { hasSystemBackButton } from '../platform'

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

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// 사진이 없으면 닉네임 첫 글자 + 톤 그라데이션 기본 이미지를 보여줘요.
export function Avatar({
  name,
  seed,
  src,
  size = 'md',
}: {
  name: string
  seed?: string | null
  src?: string | null
  size?: AvatarSize
}) {
  if (src) {
    return <img className={`avatar avatar--${size} avatar--photo`} src={src} alt="" loading="lazy" />
  }
  return (
    <span className={`avatar avatar--${size}`} data-tone={toneOf(seed ?? name)} aria-hidden="true">
      {name.charAt(0)}
    </span>
  )
}

// 아바타·닉네임을 누르면 프로필로 이동해요. 탈퇴 등으로 id가 없으면 링크 없이 보여줘요.
export function ProfileLink({
  userId,
  className,
  children,
  label,
}: {
  userId: string | null | undefined
  className?: string
  children: ReactNode
  label?: string
}) {
  if (!userId) return <span className={className}>{children}</span>
  return (
    <Link
      to={`/u/${userId}`}
      className={`profile-link${className ? ` ${className}` : ''}`}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
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
  const goBack = useGoBack(typeof back === 'string' ? back : '/feed')
  // 앱인토스에서는 토스 내비게이션 바가 뒤로가기를 이미 보여줘서 우리 뒤로가기는 그리지 않아요(중복 방지).
  const showBack = !!back && !hasSystemBackButton()
  // 그러고 나서 보여줄 게 없으면(뒤로가기만 있던 헤더) 빈 막대를 남기지 않아요.
  if (back && !showBack && !title && !left && !right) return null
  return (
    <header className="app-bar">
      {showBack ? (
        <button
          type="button"
          className="circle-button"
          aria-label="뒤로"
          onClick={goBack}
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

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])
}

// 아래에서 올라오는 시트(더보기 메뉴·확인창 등)
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  useEscape(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <span className="bottom-sheet__handle" aria-hidden="true" />
        {title && <h2 className="bottom-sheet__title">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export type SheetAction = {
  label: string
  icon?: string
  danger?: boolean
  onSelect: () => void
}

export function ActionSheet({
  open,
  onClose,
  title,
  description,
  actions,
  cancelLabel = '닫기',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  actions: SheetAction[]
  cancelLabel?: string
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {description && <p className="bottom-sheet__desc">{description}</p>}
      <div className="sheet-actions">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`sheet-action${a.danger ? ' sheet-action--danger' : ''}`}
            onClick={() => {
              onClose()
              a.onSelect()
            }}
          >
            {a.icon && <Icon name={a.icon} />}
            {a.label}
          </button>
        ))}
      </div>
      <button type="button" className="sheet-cancel" onClick={onClose}>
        {cancelLabel}
      </button>
    </BottomSheet>
  )
}

// 전체 화면 모달(약관 보기 등)
export function FullModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
}) {
  useEscape(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="full-modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <header className="full-modal__bar">
        <button type="button" className="circle-button circle-button--sm" aria-label="닫기" onClick={onClose}>
          <Icon name="close-icon" />
        </button>
        <h2>{title}</h2>
        <span className="app-bar__spacer" />
      </header>
      <div className="full-modal__body">{children}</div>
    </div>,
    document.body,
  )
}
