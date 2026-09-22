import { useState } from 'react'
import { BottomSheet, Icon } from '../../components/ui'
import { LOCATION_COPY } from '../../config/copy'
import { DEFAULT_SIDO, SIDO_LIST } from '../../config/regions'
import { useAuth } from '../../lib/auth-context'
import {
  LOCATION_LABEL_PRESETS,
  MAX_SAVED_LOCATIONS,
  parseSavedLocations,
  sigunguOptionsFor,
  type SavedLocation,
} from '../../lib/profiles'
import { supabase } from '../../lib/supabase'

// 당근마켓 "동네 설정"과 비슷한 개념: 즐겨찾는 동네를 최대 3개까지 저장하고 그중 하나로 전환해요.
// 전환하면 profiles.sido/sigungu(현재 동네)가 바뀌고, 소모임 목록이 그 동네 기준으로 다시 정렬돼요.
export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [sido, setSido] = useState<string>(DEFAULT_SIDO)
  const [sigungu, setSigungu] = useState('')
  const [saving, setSaving] = useState(false)

  if (!profile) return null
  const saved = parseSavedLocations(profile.saved_locations)

  function closeAll() {
    setAdding(false)
    onClose()
  }

  function openAdd() {
    setSido((profile!.sido as string) || DEFAULT_SIDO)
    setSigungu('')
    setLabel('')
    setAdding(true)
  }

  async function switchTo(loc: { sido: string; sigungu: string }) {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({ sido: loc.sido, sigungu: loc.sigungu }).eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
    closeAll()
  }

  async function addLocation() {
    if (!profile || !sigungu) return
    setSaving(true)
    const next: SavedLocation[] = [
      ...saved,
      { id: crypto.randomUUID(), label: label.trim() || sigungu, sido, sigungu },
    ].slice(0, MAX_SAVED_LOCATIONS)
    await supabase.from('profiles').update({ saved_locations: next, sido, sigungu }).eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
    closeAll()
  }

  async function removeLocation(id: string) {
    if (!profile) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ saved_locations: saved.filter((l) => l.id !== id) })
      .eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
  }

  return (
    <BottomSheet open={open} onClose={closeAll} title={LOCATION_COPY.sheetTitle}>
      {!adding ? (
        <>
          <p className="field-hint">
            {LOCATION_COPY.current}: {[profile.sido, profile.sigungu].filter(Boolean).join(' ') || LOCATION_COPY.unset}
          </p>

          {saved.length > 0 && (
            <ul className="list-rows">
              {saved.map((loc) => (
                <li key={loc.id} className="list-row">
                  <button
                    type="button"
                    className="list-row__label"
                    style={{ textAlign: 'left', background: 'none', border: 'none', flex: 1, cursor: 'pointer' }}
                    disabled={saving}
                    onClick={() => switchTo(loc)}
                  >
                    <strong>{loc.label}</strong> · {loc.sido} {loc.sigungu}
                  </button>
                  <button
                    type="button"
                    className="circle-button circle-button--sm"
                    aria-label={LOCATION_COPY.delete}
                    disabled={saving}
                    onClick={() => removeLocation(loc.id)}
                  >
                    <Icon name="close-icon" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {saved.length === 0 && <p className="field-hint">{LOCATION_COPY.empty}</p>}

          {saved.length < MAX_SAVED_LOCATIONS ? (
            <button type="button" className="pill-button-ghost pill-button-ghost--sm" onClick={openAdd}>
              {LOCATION_COPY.add}
            </button>
          ) : (
            <p className="field-hint">{LOCATION_COPY.full(MAX_SAVED_LOCATIONS)}</p>
          )}
        </>
      ) : (
        <div className="field">
          <span className="field-label">{LOCATION_COPY.addTitle}</span>
          <div className="chip-row">
            {LOCATION_LABEL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="chip"
                aria-pressed={label === preset}
                onClick={() => setLabel(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            className="field-input"
            placeholder={LOCATION_COPY.labelPlaceholder}
            value={label}
            maxLength={10}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="onboarding-grid">
            <select
              className="field-select"
              value={sido}
              onChange={(e) => {
                setSido(e.target.value)
                setSigungu('')
              }}
            >
              {SIDO_LIST.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select className="field-select" value={sigungu} onChange={(e) => setSigungu(e.target.value)}>
              <option value="">{LOCATION_COPY.sigunguLabel}</option>
              {sigunguOptionsFor(sido).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="chip-row">
            <button type="button" className="pill-button" disabled={!sigungu || saving} onClick={addLocation}>
              {LOCATION_COPY.save}
            </button>
            <button type="button" className="pill-button-ghost" onClick={() => setAdding(false)}>
              {LOCATION_COPY.cancel}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
