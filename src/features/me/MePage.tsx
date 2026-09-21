import { REGION_LABEL } from '../../config/brand'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import './MePage.css'

const GENDER_LABELS: Record<string, string> = { male: '남성', female: '여성' }

const WORK_TYPE_LABELS: Record<string, string> = {
  nursing: '간호·의료',
  business: '사장님·자영업',
  service: '서비스·판매',
  manufacturing: '제조·물류 교대',
  freelance: '프리랜서·크리에이터',
  etc: '기타',
}

export function MePage() {
  const { profile } = useAuth()

  if (!profile) return null

  const ageBand = profile.birth_year ? `${Math.floor((new Date().getFullYear() - profile.birth_year) / 10) * 10}대` : null

  return (
    <section className="me-page">
      <div className="me-card clay-card">
        <div className="me-avatar squircle-badge">🌙</div>
        <div>
          <h1>{profile.nickname}</h1>
          <p className="me-sub">
            {[GENDER_LABELS[profile.gender ?? ''], ageBand, profile.sigungu ?? REGION_LABEL]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div className="me-info-list clay-card">
        {profile.work_type && (
          <div className="me-info-row">
            <span>근무 유형</span>
            <span>{WORK_TYPE_LABELS[profile.work_type] ?? profile.work_type}</span>
          </div>
        )}
        <div className="me-info-row">
          <span>지역</span>
          <span>
            {profile.sido} {profile.sigungu}
          </span>
        </div>
      </div>

      <button type="button" className="me-logout pill-button-ghost" onClick={() => supabase.auth.signOut()}>
        로그아웃
      </button>
    </section>
  )
}
