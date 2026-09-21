import { Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { BungaePage } from './features/bungae/BungaePage'
import { FeedPage } from './features/feed/FeedPage'
import { MePage } from './features/me/MePage'
import './App.css'

// 홈(첫 진입 탭)은 수다방이에요.
function App() {
  return (
    <>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/bungae" element={<BungaePage />} />
          <Route path="/me" element={<MePage />} />
        </Routes>
      </main>
      <TabBar />
    </>
  )
}

export default App
