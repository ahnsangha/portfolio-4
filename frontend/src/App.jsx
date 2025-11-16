import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage' // 1. 홈 페이지 임포트
import TripDetailPage from './pages/TripDetailPage' // 2. 상세 페이지 임포트
import './App.css'

function App() {
  // (참고)
  // 나중에는 App.jsx가 'token', 'setToken' 같은 상태를 가지고
  // HomePage와 TripDetailPage에 props로 넘겨주는 것이 좋습니다.
  // 지금은 HomePage가 자체적으로 인증을 처리하도록 임시로 두었습니다.

  return (
    <div className="App">
      <Routes>
        {/* 주소 "/" (루트) 에는 HomePage를 보여줌 */}
        <Route path="/" element={<HomePage />} /> 
        
        {/* 주소 "/trip/:tripId" 에는 TripDetailPage를 보여줌 */}
        <Route path="/trip/:tripId" element={<TripDetailPage />} />
      </Routes>
    </div>
  )
}

export default App