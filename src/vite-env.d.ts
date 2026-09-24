/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM: 'web' | 'toss'
  readonly VITE_THEME: 'night' | 'hybrid'
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_AD_BANNER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
