import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { Loading } from './components/ui'
import { FEATURES } from './config/features'
import { AdminReportsPage } from './features/admin/AdminReportsPage'
import { AuthPage } from './features/auth/AuthPage'
import { BungaeCreatePage } from './features/bungae/BungaeCreatePage'
import { BungaeDetailPage } from './features/bungae/BungaeDetailPage'
import { BungaeListPage } from './features/bungae/BungaeListPage'
import { DmChatPage } from './features/dm/DmChatPage'
import { DmInboxPage } from './features/dm/DmInboxPage'
import { ComposePage } from './features/feed/ComposePage'
import { FeedPage } from './features/feed/FeedPage'
import { PostDetailPage } from './features/feed/PostDetailPage'
import { LegalPage } from './features/legal/LegalPage'
import { useAutoPushConsent } from './features/notifications/useAutoPushConsent'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { FollowListPage } from './features/profile/FollowListPage'
import { PasswordChangePage } from './features/profile/PasswordChangePage'
import { ProfileEditPage } from './features/profile/ProfileEditPage'
import { ProfilePage, UserProfileRoute } from './features/profile/ProfilePage'
import { SettingsPage } from './features/profile/SettingsPage'
import { useAuth } from './lib/auth-context'
import './App.css'

// 홈(첫 진입 탭)은 수다방이에요. 수다방·소모임·다른 사람 프로필은 비회원도 둘러볼 수 있어요(내정보 탭이 로그인 진입점).
function MeGate() {
  const { session, profile } = useAuth()
  if (!session) return <AuthPage />
  if (!profile) return <OnboardingPage />
  return <ProfilePage userId={profile.id} />
}

// 글쓰기·상세·설정처럼 한 가지 일에 집중하는 화면에서는 탭바를 숨겨요.
const FOCUS_ROUTES = [
  /^\/feed\/.+/,
  /^\/bungae\/.+/,
  /^\/me\/.+/,
  /^\/u\/[^/]+\/follows/,
  /^\/dm/,
  /^\/terms$/,
  /^\/privacy$/,
  /^\/marketing$/,
  /^\/admin/,
]

function App() {
  const { loading } = useAuth()
  useAutoPushConsent()
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
          <Route path="/me/edit" element={<ProfileEditPage />} />
          <Route path="/me/settings" element={<SettingsPage />} />
          <Route path="/me/password" element={<PasswordChangePage />} />
          <Route path="/u/:id" element={<UserProfileRoute />} />
          <Route path="/u/:id/follows" element={<FollowListPage />} />
          {/* 푸시를 누르면 여기로 와요(콘솔 템플릿의 이동 URL: intoss://dawnpeople/notifications). */}
          <Route path="/notifications" element={<Navigate to="/dm?tab=notifications" replace />} />
          {FEATURES.dm && <Route path="/dm" element={<DmInboxPage />} />}
          {FEATURES.dm && <Route path="/dm/:id" element={<DmChatPage />} />}
          {FEATURES.admin && <Route path="/admin" element={<AdminReportsPage />} />}
          <Route path="/terms" element={<LegalPage kind="terms" />} />
          <Route path="/privacy" element={<LegalPage kind="privacy" />} />
          <Route path="/marketing" element={<LegalPage kind="marketing" />} />
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </main>
      {!focused && <TabBar />}
    </>
  )
}

export default App
