import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useToast } from '../../components/toast'
import { AppBar, Avatar } from '../../components/ui'
import { EDIT_PROFILE_COPY } from '../../config/copy'
import { useAuth } from '../../lib/auth-context'
import { removePublicMedia, uploadPublicMedia, validateFile } from '../../lib/media'
import { BIO_MAX, OFF_TIME_OPTIONS, SIDO_OPTIONS, WORK_TYPE_OPTIONS } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import './ProfilePage.css'

const NICKNAME_CHANGE_DAYS = 7

export function ProfileEditPage() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [workType, setWorkType] = useState(profile?.work_type ?? '')
  const [showWorkBadge, setShowWorkBadge] = useState(profile?.show_work_badge ?? true)
  const [offTime, setOffTime] = useState(profile?.off_time_band ?? '')
  const [sido, setSido] = useState(profile?.sido ?? '경기')
  const [sigungu, setSigungu] = useState(profile?.sigungu ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile])
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl])

  if (!profile) return <Navigate to="/me" replace />

  const nicknameUnlockAt = new Date(new Date(profile.nickname_changed_at).getTime() + NICKNAME_CHANGE_DAYS * 86400000)
  const nicknameLocked = nicknameUnlockAt.getTime() > Date.now()
  const shownPhoto = previewUrl ?? (photoRemoved ? null : profile.avatar_url)

  function pickPhoto(list: FileList | null) {
    const file = list?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    const invalid = validateFile(file)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setPhotoFile(file)
    setPhotoRemoved(false)
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      let avatarUrl = profile.avatar_url
      if (photoFile) avatarUrl = (await uploadPublicMedia(profile.id, photoFile)).url ?? null
      else if (photoRemoved) avatarUrl = null

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: avatarUrl,
          bio: bio.trim() || null,
          work_type: workType || null,
          show_work_badge: showWorkBadge,
          off_time_band: offTime || null,
          sido,
          sigungu: sigungu.trim() || null,
        })
        .eq('id', profile.id)
      if (updateError) throw new Error(EDIT_PROFILE_COPY.saveError)

      const trimmedNickname = nickname.trim()
      if (trimmedNickname && trimmedNickname !== profile.nickname) {
        const { error: nickError } = await supabase.rpc('change_nickname', { p_new_nickname: trimmedNickname })
        if (nickError) {
          throw new Error(nickError.code === '23505' ? EDIT_PROFILE_COPY.nicknameTaken : nickError.message)
        }
      }

      if (avatarUrl !== profile.avatar_url && profile.avatar_url) void removePublicMedia([profile.avatar_url])
      await refreshProfile()
      toast.show(EDIT_PROFILE_COPY.saved)
      navigate('/me', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : EDIT_PROFILE_COPY.saveError)
      setSaving(false)
    }
  }

  return (
    <section className="profile-edit-page">
      <AppBar
        back
        title={EDIT_PROFILE_COPY.title}
        right={
          <button type="button" className="pill-button pill-button--sm" disabled={saving || nickname.trim().length < 2} onClick={handleSave}>
            {EDIT_PROFILE_COPY.save}
          </button>
        }
      />

      <div className="edit-photo">
        <Avatar name={nickname || profile.nickname} seed={profile.id} src={shownPhoto} size="xl" />
        <div className="edit-photo__buttons">
          <button type="button" className="pill-button-ghost pill-button-ghost--sm" onClick={() => fileRef.current?.click()}>
            {EDIT_PROFILE_COPY.photoChange}
          </button>
          {shownPhoto && (
            <button
              type="button"
              className="pill-button-ghost pill-button-ghost--sm"
              onClick={() => {
                setPhotoFile(null)
                setPhotoRemoved(true)
              }}
            >
              {EDIT_PROFILE_COPY.photoReset}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files)} />
      </div>

      <div className="glass-panel edit-form">
        <label className="field">
          <span className="field-label">{EDIT_PROFILE_COPY.nickname}</span>
          <input
            className="field-input"
            value={nickname}
            maxLength={12}
            disabled={nicknameLocked}
            onChange={(e) => setNickname(e.target.value)}
          />
          <span className="field-hint">
            {nicknameLocked
              ? EDIT_PROFILE_COPY.nicknameLocked(nicknameUnlockAt.toLocaleDateString('ko-KR'))
              : EDIT_PROFILE_COPY.nicknameHint(NICKNAME_CHANGE_DAYS)}
          </span>
        </label>

        <label className="field">
          <span className="field-label">{EDIT_PROFILE_COPY.bio}</span>
          <textarea
            className="field-textarea"
            rows={2}
            maxLength={BIO_MAX}
            placeholder={EDIT_PROFILE_COPY.bioPlaceholder}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <span className="field-counter">
            {bio.length}/{BIO_MAX}
          </span>
        </label>

        <div className="field">
          <span className="field-label">{EDIT_PROFILE_COPY.workType}</span>
          <div className="chip-row">
            {WORK_TYPE_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={workType === value}
                onClick={() => setWorkType(workType === value ? '' : value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="toggle-row">
            {EDIT_PROFILE_COPY.showWorkBadge}
            <input type="checkbox" checked={showWorkBadge} onChange={(e) => setShowWorkBadge(e.target.checked)} />
          </label>
        </div>

        <div className="field">
          <span className="field-label">{EDIT_PROFILE_COPY.offTime}</span>
          <div className="chip-row">
            {OFF_TIME_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={offTime === value}
                onClick={() => setOffTime(offTime === value ? '' : value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">{EDIT_PROFILE_COPY.region}</span>
          <div className="edit-region">
            <select className="field-select" value={sido} onChange={(e) => setSido(e.target.value)} aria-label={EDIT_PROFILE_COPY.region}>
              {SIDO_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input className="field-input" value={sigungu} placeholder="부천시" onChange={(e) => setSigungu(e.target.value)} />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
      </div>
    </section>
  )
}
