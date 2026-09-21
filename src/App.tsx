import { Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { AuthPage } from './features/auth/AuthPage'
import { BungaeCreatePage } from './features/bungae/BungaeCreatePage'
import { BungaeDetailPage } from './features/bungae/BungaeDetailPage'
import { BungaeListPage } from './features/bungae/BungaeListPage'
import { FeedPage } from './features/feed/FeedPage'
import { MePage } from './features/me/MePage'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { useAuth } from './lib/auth-context'
import './App.css'

// 홈(첫 진입 탭)은 수다방이에요. 수다방·소모임은 비회원도 둘러볼 수 있어요(내정보 탭이 로그인 진입점).
function MeGate() {
  const { session, profile } = useAuth()
  if (!session) return <AuthPage />
  if (!profile) return <OnboardingPage />
  return <MePage />
}

function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <main className="app-content">
        <p>불러오는 중...</p>
      </main>
    )
  }

  return (
    <>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/bungae" element={<BungaeListPage />} />
          <Route path="/bungae/new" element={<BungaeCreatePage />} />
          <Route path="/bungae/:id" element={<BungaeDetailPage />} />
          <Route path="/me" element={<MeGate />} />
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  )
}

export default App
