import { Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { AuthPage } from './features/auth/AuthPage'
import { BungaePage } from './features/bungae/BungaePage'
import { FeedPage } from './features/feed/FeedPage'
import { MePage } from './features/me/MePage'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { useAuth } from './lib/auth-context'
import './App.css'

// 홈(첫 진입 탭)은 수다방이에요.
function App() {
  const { loading, session, profile } = useAuth()

  if (loading) {
    return (
      <main className="app-content">
        <p>불러오는 중...</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="app-content">
        <AuthPage />
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="app-content">
        <OnboardingPage />
      </main>
    )
  }

  return (
    <>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/bungae" element={<BungaePage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  )
}

export default App
