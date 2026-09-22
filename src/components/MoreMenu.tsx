import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MENU_COPY } from '../config/copy'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { useToast } from './toast'
import { ActionSheet, Icon, type SheetAction } from './ui'

export type ReportTarget = {
  type: 'post' | 'comment' | 'bungae' | 'bungae_comment' | 'user'
  id: string | number
}

type Props = {
  isMine: boolean
  authorId: string | null
  authorName: string
  report: ReportTarget
  onEdit?: () => void
  onDelete?: () => void | Promise<void>
  deleteConfirm?: string
  className?: string
}

// 내 글·댓글: 수정/삭제, 다른 사람: 신고/차단
export function MoreMenu({ isMine, authorId, authorName, report, onEdit, onDelete, deleteConfirm, className }: Props) {
  const { profile, block } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [sheet, setSheet] = useState<'menu' | 'report' | 'block' | 'delete' | null>(null)

  const close = () => setSheet(null)

  async function submitReport(reason: string) {
    if (!profile) return
    const { error } = await supabase.from('reports').insert({
      reporter_id: profile.id,
      target_type: report.type,
      target_id: String(report.id),
      reason,
    })
    toast.show(error ? MENU_COPY.reportFailed : MENU_COPY.reportDone)
  }

  async function confirmBlock() {
    if (!authorId) return
    try {
      await block(authorId)
      toast.show(MENU_COPY.blockDone)
    } catch (err) {
      toast.show(err instanceof Error ? err.message : MENU_COPY.blockFailed)
    }
  }

  const menuActions: SheetAction[] = isMine
    ? [
        ...(onEdit ? [{ label: MENU_COPY.edit, icon: 'edit-icon', onSelect: onEdit }] : []),
        ...(onDelete
          ? [{ label: MENU_COPY.delete, icon: 'trash-icon', danger: true, onSelect: () => setSheet('delete') }]
          : []),
      ]
    : [
        { label: MENU_COPY.report, icon: 'flag-icon', danger: true, onSelect: () => setSheet('report') },
        ...(authorId
          ? [{ label: MENU_COPY.block, icon: 'block-icon', onSelect: () => setSheet('block') }]
          : []),
      ]

  if (menuActions.length === 0) return null

  return (
    <>
      <button
        type="button"
        className={`more-button${className ? ` ${className}` : ''}`}
        aria-label={MENU_COPY.more}
        onClick={(e) => {
          e.stopPropagation()
          if (!profile) {
            navigate('/me')
            return
          }
          setSheet('menu')
        }}
      >
        <Icon name="more-icon" />
      </button>

      <ActionSheet open={sheet === 'menu'} onClose={close} actions={menuActions} cancelLabel={MENU_COPY.cancel} />

      <ActionSheet
        open={sheet === 'report'}
        onClose={close}
        title={MENU_COPY.reportTitle}
        actions={MENU_COPY.reportReasons.map((reason) => ({ label: reason, onSelect: () => submitReport(reason) }))}
        cancelLabel={MENU_COPY.cancel}
      />

      <ActionSheet
        open={sheet === 'block'}
        onClose={close}
        title={MENU_COPY.blockTitle(authorName)}
        description={MENU_COPY.blockDesc}
        actions={[{ label: MENU_COPY.block, danger: true, onSelect: confirmBlock }]}
        cancelLabel={MENU_COPY.cancel}
      />

      <ActionSheet
        open={sheet === 'delete'}
        onClose={close}
        title={deleteConfirm ?? MENU_COPY.deleteConfirm}
        description={MENU_COPY.deleteDesc}
        actions={[{ label: MENU_COPY.delete, danger: true, onSelect: () => void onDelete?.() }]}
        cancelLabel={MENU_COPY.cancel}
      />
    </>
  )
}
