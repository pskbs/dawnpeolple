import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { Loading } from './components/ui'
import { AuthPage } from './features/auth/AuthPage'
import { BungaeCreatePage } from './features/bungae/BungaeCreatePage'
import { BungaeDetailPage } from './features/bungae/BungaeDetailPage'
import { BungaeListPage } from './features/bungae/BungaeListPage'
import { ComposePage } from './features/feed/ComposePage'
import { FeedPage } from './features/feed/FeedPage'
import { PostDetailPage } from './features/feed/PostDetailPage'
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

// 글쓰기·상세처럼 한 가지 일에 집중하는 화면에서는 인스타그램처럼 탭바를 숨겨요.
const FOCUS_ROUTES = [/^\/feed\/.+/, /^\/bungae\/.+/]

function App() {
  const { loading } = useAuth()
  const { pathname } = useLocation()
  const focused = FOCUS_ROUTES.some((re) => re.test(pathname))

  if (loading) {
    return (
      <main className="app-content">
        <Loading />
      </main>
    )
  }

  return (
    <>
      <main className={`app-content${focused ? ' app-content--focus' : ''}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/feed/new" element={<ComposePage />} />
          <Route path="/feed/:id" element={<PostDetailPage />} />
          <Route path="/bungae" element={<BungaeListPage />} />
          <Route path="/bungae/new" element={<BungaeCreatePage />} />
          <Route path="/bungae/:id" element={<BungaeDetailPage />} />
          <Route path="/me" element={<MeGate />} />
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </main>
      {!focused && <TabBar />}
    </>
  )
}

export default App
