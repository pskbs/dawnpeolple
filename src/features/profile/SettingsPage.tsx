import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useToast } from '../../components/toast'
import { ActionSheet, AppBar, Avatar, BottomSheet, Icon } from '../../components/ui'
import { MENU_COPY, NOTIFICATION_COPY, SETTINGS_COPY } from '../../config/copy'
import { FEATURES } from '../../config/features'
import { LocationSheet } from '../location/LocationSheet'
import { NotificationSettingsSection } from '../notifications/NotificationSettingsSection'
import { useAuth } from '../../lib/auth-context'
import { purgeMyStorage } from '../../lib/media'
import { fetchProfileCards, GENDER_LABELS, parseSavedLocations, type ProfileCard } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import { ageBandOf } from './profile-api'
import './ProfilePage.css'

export function SettingsPage() {
  const { session, profile, blockedIds, unblock } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [sheet, setSheet] = useState<'logout' | 'withdraw' | 'blocked' | 'location' | null>(null)
  const [blockedCards, setBlockedCards] = useState<ProfileCard[]>([])
  const [withdrawChecked, setWithdrawChecked] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  if (!profile) return <Navigate to="/me" replace />

  async function openBlocked() {
    const cards = await fetchProfileCards([...blockedIds])
    setBlockedCards(Object.values(cards))
    setSheet('blocked')
  }

  // 로그아웃하면 이 화면이 /me로 돌아가려 하므로, 먼저 수다방으로 이동한 뒤 로그아웃해요.
  async function logout() {
    navigate('/feed', { replace: true })
    await supabase.auth.signOut()
  }

  async function withdraw() {
    if (!profile) return
    setWithdrawing(true)
    setWithdrawError(null)
    try {
      const { data: convs } = await supabase.from('conversations').select('id')
      await purgeMyStorage(
        profile.id,
        (convs ?? []).map((c) => c.id as number),
      )
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw error
      navigate('/feed', { replace: true })
      await supabase.auth.signOut({ scope: 'local' })
      toast.show(SETTINGS_COPY.withdrawDone)
    } catch {
      setWithdrawError(SETTINGS_COPY.withdrawError)
      setWithdrawing(false)
    }
  }

  return (
    <section className="settings-page">
      <AppBar back="/me" title={SETTINGS_COPY.title} />

      <h2 className="settings-section-title">{SETTINGS_COPY.sectionAccount}</h2>
      <div className="sheet list-rows">
        <Link to="/me/edit" className="list-row">
          <Icon name="edit-icon" />
          <span className="list-row__label">{SETTINGS_COPY.editProfile}</span>
          <Icon name="chevron-right-icon" className="list-row__chevron" />
        </Link>
        {/* 이메일로 가입한 계정만 비밀번호가 있어요(토스 로그인은 비밀번호 없음). */}
        {session?.user.email && (
          <Link to="/me/password" className="list-row">
            <Icon name="lock-icon" />
            <span className="list-row__label">{SETTINGS_COPY.changePassword}</span>
            <Icon name="chevron-right-icon" className="list-row__chevron" />
          </Link>
        )}
        {FEATURES.admin && profile.role === 'admin' && (
          <Link to="/admin" className="list-row">
            <Icon name="flag-icon" />
            <span className="list-row__label">{SETTINGS_COPY.admin}</span>
            <Icon name="chevron-right-icon" className="list-row__chevron" />
          </Link>
        )}
        <button type="button" className="list-row" onClick={openBlocked}>
          <Icon name="block-icon" />
          <span className="list-row__label">{SETTINGS_COPY.blockedUsers}</span>
          <span className="muted">{blockedIds.size}</span>
          <Icon name="chevron-right-icon" className="list-row__chevron" />
        </button>
      </div>

      <h2 className="settings-section-title">{NOTIFICATION_COPY.settingsTitle}</h2>
      <NotificationSettingsSection />

      <div className="sheet settings-info">
        <div className="settings-info__row">
          <span>{SETTINGS_COPY.gender}</span>
          <span>{profile.gender ? GENDER_LABELS[profile.gender] : '-'}</span>
        </div>
        <div className="settings-info__row">
          <span>{SETTINGS_COPY.ageBand}</span>
          <span>{ageBandOf(profile.birth_year) ?? '-'}</span>
        </div>
        <button type="button" className="settings-info__row settings-info__row--button" onClick={() => setSheet('location')}>
          <span>{SETTINGS_COPY.region}</span>
          <span>
            {[profile.sido, profile.sigungu].filter(Boolean).join(' ') || '-'}
            {parseSavedLocations(profile.saved_locations).length > 0 &&
              ` · 저장 ${parseSavedLocations(profile.saved_locations).length}`}
          </span>
        </button>
        <p className="settings-info__note">{SETTINGS_COPY.myInfoNote}</p>
      </div>

      <h2 className="settings-section-title">{SETTINGS_COPY.sectionInfo}</h2>
      <div className="sheet list-rows">
        <Link to="/terms" className="list-row">
          <Icon name="file-icon" />
          <span className="list-row__label">{SETTINGS_COPY.terms}</span>
          <Icon name="chevron-right-icon" className="list-row__chevron" />
        </Link>
        <Link to="/privacy" className="list-row">
          <Icon name="lock-icon" />
          <span className="list-row__label">{SETTINGS_COPY.privacy}</span>
          <Icon name="chevron-right-icon" className="list-row__chevron" />
        </Link>
      </div>

      <div className="settings-small">
        <button type="button" onClick={() => setSheet('logout')}>
          {SETTINGS_COPY.logout}
        </button>
        <button type="button" onClick={() => setSheet('withdraw')}>
          {SETTINGS_COPY.withdraw}
        </button>
      </div>

      <ActionSheet
        open={sheet === 'logout'}
        onClose={() => setSheet(null)}
        title={SETTINGS_COPY.logoutConfirm}
        actions={[{ label: SETTINGS_COPY.logout, danger: true, onSelect: logout }]}
        cancelLabel={MENU_COPY.cancel}
      />

      <LocationSheet open={sheet === 'location'} onClose={() => setSheet(null)} />

      <BottomSheet open={sheet === 'blocked'} onClose={() => setSheet(null)} title={SETTINGS_COPY.blockedUsers}>
        {blockedCards.length === 0 ? (
          <p className="bottom-sheet__desc">{SETTINGS_COPY.blockedEmpty}</p>
        ) : (
          <ul className="list-rows">
            {blockedCards.map((c) => (
              <li key={c.id} className="person-row">
                <Avatar name={c.nickname} seed={c.id} src={c.avatar_url} size="sm" />
                <span className="person-row__text">
                  <span className="person-row__name">{c.nickname}</span>
                </span>
                <button
                  type="button"
                  className="pill-button-ghost pill-button-ghost--sm"
                  onClick={async () => {
                    await unblock(c.id)
                    setBlockedCards((prev) => prev.filter((x) => x.id !== c.id))
                    toast.show(MENU_COPY.unblockDone)
                  }}
                >
                  {MENU_COPY.unblock}
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>

      <BottomSheet
        open={sheet === 'withdraw'}
        onClose={() => !withdrawing && setSheet(null)}
        title={SETTINGS_COPY.withdrawTitle}
      >
        <ul className="withdraw-list">
          {SETTINGS_COPY.withdrawBody.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <label className="withdraw-check">
          <input type="checkbox" checked={withdrawChecked} onChange={(e) => setWithdrawChecked(e.target.checked)} />
          {SETTINGS_COPY.withdrawCheck}
        </label>
        {withdrawError && <p className="error-text">{withdrawError}</p>}
        <button
          type="button"
          className="pill-button pill-button--block pill-button--danger"
          disabled={!withdrawChecked || withdrawing}
          onClick={withdraw}
        >
          {withdrawing ? SETTINGS_COPY.withdrawing : SETTINGS_COPY.withdrawSubmit}
        </button>
        <button type="button" className="sheet-cancel" disabled={withdrawing} onClick={() => setSheet(null)}>
          {MENU_COPY.cancel}
        </button>
      </BottomSheet>
    </section>
  )
}
