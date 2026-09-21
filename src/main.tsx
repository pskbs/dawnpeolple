import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth-context'
import './styles/themes/night.css'
import './styles/themes/hybrid.css'
import './index.css'
import App from './App.tsx'

// OS 다크모드를 따르지 않고, 환경변수로 지정한 테마만 사용해요(요청서 10-3).
document.documentElement.setAttribute('data-theme', import.meta.env.VITE_THEME ?? 'night')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
