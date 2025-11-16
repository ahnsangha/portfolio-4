import { useState } from 'react'
import axios from 'axios' // axios 임포트
import './App.css' // 기본 CSS

// 백엔드 API 주소 (http://127.0.0.1:8000)
const API_URL = 'http://127.0.0.1:8000'

function App() {
  // 1. 입력 상태 관리 (이메일, 비밀번호)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // 2. 로그인 성공 시 토큰 저장
  const [token, setToken] = useState(null)
  
  // 3. 오류 메시지 관리
  const [error, setError] = useState('')

  // 4. "내 정보" 저장
  const [userData, setUserData] = useState(null)


  // 5. 로그인 폼 제출 이벤트 핸들러
  const handleLogin = async (e) => {
    e.preventDefault() // 폼 제출 시 페이지 새로고침 방지
    setError('') // 오류 메시지 초기화
    setUserData(null) // 사용자 정보 초기화

    try {
      // --- 백엔드에 로그인 요청 (/api/auth/login) ---
      // FastAPI의 OAuth2PasswordRequestForm은 'x-www-form-urlencoded' 형식의
      // 'username'과 'password' 필드를 기대합니다. (email 아님 주의!)
      const formData = new URLSearchParams()
      formData.append('username', email) // 'username' 키에 이메일을 담습니다.
      formData.append('password', password)

      const response = await axios.post(
        `${API_URL}/api/auth/login`, 
        formData,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      )

      // 로그인 성공 시
      const accessToken = response.data.access_token
      setToken(accessToken)
      console.log('로그인 성공! 토큰:', accessToken)

    } catch (err) {
      // 로그인 실패 시
      console.error('로그인 오류:', err)
      if (err.response && err.response.data) {
        setError(err.response.data.detail || '로그인에 실패했습니다.')
      } else {
        setError('서버에 연결할 수 없습니다.')
      }
    }
  }

  // 6. "내 정보 가져오기" (GET /api/users/me) 핸들러
  const fetchMyInfo = async () => {
    if (!token) {
      setError('로그인이 필요합니다.')
      return
    }
    setError('')
    setUserData(null)

    try {
      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}` // 헤더에 토큰을 실어 보냅니다.
        }
      })
      
      // 성공 시
      setUserData(response.data)
      console.log('사용자 정보:', response.data)

    } catch (err) {
      console.error('정보 가져오기 오류:', err)
      setError('사용자 정보를 가져오는데 실패했습니다. (토큰 만료?)')
    }
  }

  return (
    <>
      <h1>여행 계획 플래너</h1>
      
      <div className="card">
        {/* === 로그인 폼 === */}
        <form onSubmit={handleLogin}>
          <div>
            <label>이메일: </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div>
            <label>비밀번호: </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <button type="submit">로그인</button>
        </form>
        
        {/* 오류 메시지 표시 */}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>

      <div className="card">
        {/* === 토큰 및 "내 정보" 테스트 === */}
        {token ? (
          <>
            <p><strong>Access Token:</strong> (..{token.slice(-10)})</p>
            <button onClick={fetchMyInfo}>내 정보 가져오기</button>
            {userData && (
              <div>
                <h4>로그인된 사용자:</h4>
                <p>이메일: {userData.email}</p>
                <p>이름: {userData.username}</p>
              </div>
            )}
          </>
        ) : (
          <p>로그인하세요.</p>
        )}
      </div>
    </>
  )
}

export default App