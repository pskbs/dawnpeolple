import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export type Profile = {
  id: string
  nickname: string
  nickname_changed_at: string
  gender: string | null
  birth_year: number | null
  sido: string | null
  sigungu: string | null
  work_type: string | null
  show_work_badge: boolean
  off_time_band: string | null
  avatar_url: string | null
  bio: string | null
  role: string
}

type AuthState = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  refreshProfile: () => Promise<void>
  // 내가 차단한 사용자. 피드·댓글·DM 목록에서 가려요.
  blockedIds: Set<string>
  block: (userId: string) => Promise<void>
  unblock: (userId: string) => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())

  const loadUserData = useCallback(async (userId: string) => {
    const [{ data: profileRow }, { data: blockRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
    ])
    setProfile(profileRow as Profile | null)
    setBlockedIds(new Set((blockRows ?? []).map((r) => r.blocked_id as string)))
  }, [])

  async function refreshProfile() {
    if (session?.user.id) await loadUserData(session.user.id)
  }

  async function block(userId: string) {
    if (!session?.user.id) return
    const { error } = await supabase.from('blocks').insert({ blocker_id: session.user.id, blocked_id: userId })
    if (error && error.code !== '23505') throw new Error('차단하지 못했어요. 잠시 후 다시 시도해 주세요.')
    setBlockedIds((prev) => new Set(prev).add(userId))
  }

  async function unblock(userId: string) {
    if (!session?.user.id) return
    await supabase.from('blocks').delete().eq('blocker_id', session.user.id).eq('blocked_id', userId)
    setBlockedIds((prev) => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user.id) {
        loadUserData(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user.id) {
        loadUserData(newSession.user.id)
      } else {
        setProfile(null)
        setBlockedIds(new Set())
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadUserData])

  return (
    <AuthContext.Provider value={{ loading, session, profile, refreshProfile, blockedIds, block, unblock }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있어요')
  return ctx
}
