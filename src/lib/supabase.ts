import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 설정되어 있지 않아요. .env를 확인하세요.')
}

// 클라이언트에는 anon key만 사용합니다. service role key는 절대 여기 넣지 마세요(api/ 서버 전용).
// 자동 로그인: 세션을 기기(localStorage)에 저장하고 만료 전에 자동으로 갱신해요.
// 로그아웃하거나 탈퇴하기 전까지 로그인 상태가 유지돼요(Supabase 기본 refresh token은 만료 기한 없음).
// storageKey를 바꾸면 기존 사용자가 모두 로그아웃되니 바꾸지 마세요.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
