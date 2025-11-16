import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import '../App.css'

const API_URL = 'http://127.0.0.1:8000'
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
})

export default function HomePage() {
  const [token, setToken] = useState(localStorage.getItem('MY_APP_TOKEN') || null) 
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [userData, setUserData] = useState(null)
  const [trips, setTrips] = useState([])
  const [newTripTitle, setNewTripTitle] = useState('')
  const [newTripStartDate, setNewTripStartDate] = useState('')
  const [newTripEndDate, setNewTripEndDate] = useState('')
  const [editingTripId, setEditingTripId] = useState(null); // 현재 수정 중인 여행의 ID
  const [editingTripTitle, setEditingTripTitle] = useState(""); // 수정 중인 여행의 새 제목

  // (중요) token 상태가 변경될 때마다 '단일' api 인스턴스의 헤더를 업데이트
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      localStorage.setItem('MY_APP_TOKEN', token) 
      fetchMyInfo() 
    } else {
      delete api.defaults.headers.common['Authorization']
      localStorage.removeItem('MY_APP_TOKEN') 
      setUserData(null)
      setTrips([])
    }
  }, [token]) 

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const formData = new URLSearchParams()
      formData.append('username', email)
      formData.append('password', password)

      // 로그인 요청은 토큰이 필요 없으므로 'axios'를 직접 사용
      const response = await axios.post(
        `${API_URL}/api/auth/login`, 
        formData,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
      setToken(response.data.access_token) 
    } catch (err) {
      setError(err.response?.data?.detail || '로그인 실패')
    }
  }

  const fetchMyInfo = async () => {
    setError('')
    try {
      const response = await api.get('/api/users/me')
      setUserData(response.data)
      setTrips(response.data.trips || []) 
    } catch (err) {
      setError('정보 가져오기 실패 (토큰 만료?)')
      setToken(null) 
    }
  }

  const fetchMyTrips = async () => {
    try {
      const response = await api.get('/api/trips')
      setTrips(response.data)
    } catch (err) {
      setError('여행 목록을 불러오지 못했습니다.')
    }
  }

  const handleCreateTrip = async (e) => {
    e.preventDefault()
    if (!newTripTitle) { setError('여행 제목을 입력하세요.'); return }
    setError('')

    try {
      const newTrip = {
        title: newTripTitle,
        start_date: newTripStartDate || null,
        end_date: newTripEndDate || null
      }
      await api.post('/api/trips', newTrip)
      setNewTripTitle('')
      setNewTripStartDate('')
      setNewTripEndDate('')
      fetchMyTrips() 
    } catch (err) {
      setError('여행 생성에 실패했습니다.')
    }
  }

  // --- 여행(Trip) 수정 핸들러 ---
  const handleUpdateTripTitle = async (tripId) => {
    if (!editingTripTitle) {
      setError("여행 제목을 입력해주세요.");
      return;
    }
    setError('');

    try {
      // PUT /api/trips/{trip_id} 호출
      await api.put(`/api/trips/${tripId}`, {
        title: editingTripTitle 
      });

      // 성공 시: 수정 모드 종료 및 목록 새로고침
      setEditingTripId(null);
      setEditingTripTitle("");
      fetchMyTrips();

    } catch (err) {
      console.error("여행 제목 수정 오류:", err);
      setError("여행 제목 수정에 실패했습니다.");
    }
  }

  // --- 여행(Trip) 삭제 핸들러 ---
  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm("정말로 이 여행을 삭제하시겠습니까?")) {
      return;
    }
    setError('');
    
    try {
      // (이제 'api'는 항상 토큰을 가짐)
      await api.delete(`/api/trips/${tripId}`); 
      fetchMyTrips(); 
    } catch (err) {
      console.error("여행 삭제 오류:", err);
      // 401 오류가 났는지도 확인
      if (err.response && err.response.status === 401) {
        setError("인증이 만료되었습니다. 다시 로그인해주세요.");
        setToken(null);
      } else {
        setError("여행 삭제에 실패했습니다.");
      }
    }
  }

  return (
    <>
      <h1>여행 계획 플래너</h1>
      
      {/* === 인증 영역 === */}
      <div className="card">
        {!token ? (
          // --- 로그인 폼 (토큰이 없을 때) ---
          <form onSubmit={handleLogin}>
            <div>
              <label>이메일: </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label>비밀번호: </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit">로그인</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
          </form>
        ) : (
          // --- 내 정보 (토큰이 있을 때) ---
          <div>
            {userData ? (
              <p>환영합니다, {userData.username}님! ({userData.email})</p>
            ) : (
              <p>로딩 중...</p>
            )}
            <button onClick={() => setToken(null)}>로그아웃</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
          </div>
        )}
      </div>

      {/* === 여행 관리 영역 (로그인 시에만 보임) === */}
      {token && (
        <>
          {/* --- 새 여행 만들기 폼 --- */}
          <div className="card">
            <h3>새 여행 만들기</h3>
            <form onSubmit={handleCreateTrip}>
              <div>
                <label>여행 제목: </label>
                <input 
                  type="text" 
                  value={newTripTitle} 
                  onChange={(e) => setNewTripTitle(e.target.value)} 
                />
              </div>
              <div>
                <label>시작일: </label>
                <input 
                  type="date" 
                  value={newTripStartDate} 
                  onChange={(e) => setNewTripStartDate(e.target.value)} 
                />
              </div>
              <div>
                <label>종료일: </label>
                <input 
                  type="date" 
                  value={newTripEndDate} 
                  onChange={(e) => setNewTripEndDate(e.target.value)} 
                />
              </div>
              <button type="submit">여행 추가</button>
            </form>
          </div>

          <div className="card">
          <h3>내 여행 목록</h3>
          {trips.length > 0 ? (
            <ul>
              {trips.map((trip) => (
                <li key={trip.id}>
                  
                  {/* --- 수정 중일 때 (editingTripId === trip.id) --- */}
                  {editingTripId === trip.id ? (
                    <>
                      <input
                        type="text"
                        value={editingTripTitle}
                        onChange={(e) => setEditingTripTitle(e.target.value)}
                      />
                      <button onClick={() => handleUpdateTripTitle(trip.id)} style={{ marginLeft: '5px' }}>저장</button>
                      <button onClick={() => setEditingTripId(null)} style={{ marginLeft: '5px' }}>취소</button>
                    </>
                  ) : (
                    <>
                      {/* --- 평소 상태 --- */}
                      <strong>
                        <Link to={`/trip/${trip.id}`}>{trip.title}</Link>
                      </strong> 
                      ({trip.start_date || 'N/A'} ~ {trip.end_date || 'N/A'})
                      
                      {/* 수정 버튼 */}
                      <button 
                        onClick={() => {
                          setEditingTripId(trip.id);
                          setEditingTripTitle(trip.title); // 현재 제목을 입력창에 설정
                        }}
                        style={{ marginLeft: '10px', background: 'none', border: '1px solid gray', padding: '2px 5px', cursor: 'pointer' }}
                      >
                        수정
                      </button>

                      {/* 삭제 버튼 */}
                      <button 
                        onClick={() => handleDeleteTrip(trip.id)}
                        style={{ marginLeft: '5px', color: 'red', background: 'none', border: '1px solid red', padding: '2px 5px', cursor: 'pointer' }}
                      >
                        삭제
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>아직 생성된 여행이 없습니다.</p>
          )}
        </div>
        </>
      )}
    </>
  )
}