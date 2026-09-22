import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MENU_COPY } from '../config/copy'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { useToast } from './toast'
import { ActionSheet, BottomSheet, Icon, type SheetAction } from './ui'

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
  const [sheet, setSheet] = useState<'menu' | 'report' | 'report-custom' | 'block' | 'delete' | null>(null)
  const [customReason, setCustomReason] = useState('')

  const close = () => setSheet(null)

  // 직접 입력은 reason='직접 입력', 적은 내용은 detail에 저장해요(어드민·reports_overview에서 확인).
  async function submitReport(reason: string, detail?: string) {
    if (!profile) return
    const { error } = await supabase.from('reports').insert({
      reporter_id: profile.id,
      target_type: report.type,
      target_id: String(report.id),
      reason,
      detail: detail || null,
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
        actions={[
          ...MENU_COPY.reportReasons.map((reason) => ({ label: reason, onSelect: () => submitReport(reason) })),
          {
            label: MENU_COPY.reportCustom,
            icon: 'edit-icon',
            onSelect: () => {
              setCustomReason('')
              setSheet('report-custom')
            },
          },
        ]}
        cancelLabel={MENU_COPY.cancel}
      />

      <BottomSheet open={sheet === 'report-custom'} onClose={close} title={MENU_COPY.reportCustomTitle}>
        <form
          className="report-custom"
          onSubmit={(e) => {
            e.preventDefault()
            const text = customReason.trim()
            if (!text) return
            close()
            submitReport(MENU_COPY.reportCustom, text)
          }}
        >
          <textarea
            className="field-textarea"
            rows={4}
            maxLength={500}
            autoFocus
            aria-label={MENU_COPY.reportCustomTitle}
            placeholder={MENU_COPY.reportCustomPlaceholder}
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
          />
          <button type="submit" className="pill-button pill-button--block" disabled={!customReason.trim()}>
            {MENU_COPY.reportSubmit}
          </button>
        </form>
        <button type="button" className="sheet-cancel" onClick={close}>
          {MENU_COPY.cancel}
        </button>
      </BottomSheet>

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
