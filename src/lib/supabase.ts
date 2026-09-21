import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 설정되어 있지 않아요. .env를 확인하세요.')
}

// 클라이언트에는 anon key만 사용합니다. service role key는 절대 여기 넣지 마세요(api/ 서버 전용).
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
