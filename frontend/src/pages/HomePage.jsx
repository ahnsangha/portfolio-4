import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import '../App.css'
import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { token, userData, api, login, logout, isLoading } = useAuth();

  // (로그인 폼 상태)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // (여행 목록 및 새 폼 상태)
  const [trips, setTrips] = useState([])
  const [newTripTitle, setNewTripTitle] = useState('')
  const [newTripStartDate, setNewTripStartDate] = useState('')
  const [newTripEndDate, setNewTripEndDate] = useState('')

  // (useEffect, handleLogin은 이전과 동일)
  useEffect(() => {
    if (userData) {
      setTrips(userData.trips || []);
    } else {
      setTrips([]);
    }
  }, [userData]); 

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.detail || '로그인 실패');
    }
  }

  // fetchMyTrips는 새 여행 생성 후 목록 새로고침을 위해 필요
  const fetchMyTrips = async () => {
    try {
      const response = await api.get('/api/trips')
      setTrips(response.data)
    } catch (err) {
      setError('여행 목록을 불러오지 못했습니다.');
      if (err.response && err.response.status === 401) {
        logout(); 
      }
    }
  }

  // (handleCreateTrip은 그대로 유지)
  const handleCreateTrip = async (e) => {
    e.preventDefault()
    if (!newTripTitle) { setError('여행 제목을 입력하세요.'); return }
    setError('')
    try {
      await api.post('/api/trips', {
        title: newTripTitle,
        start_date: newTripStartDate || null,
        end_date: newTripEndDate || null
      })
      setNewTripTitle('')
      setNewTripStartDate('')
      setNewTripEndDate('')
      fetchMyTrips() 
    } catch (err) {
      setError('여행 생성에 실패했습니다.');
      if (err.response && err.response.status === 401) logout();
    }
  }

  // (isLoading, 로그인 폼, 내 정보 렌더링은 동일)
  if (isLoading) {
    return <p>로딩 중...</p>
  }

  return (
    <>
      <h1>여행 계획 플래너</h1>
      
      <div className="card">
        {!token ? (
          // --- 로그인 폼 (토큰이 없을 때) ---
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>이메일:</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>비밀번호:</label>
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
            <button onClick={logout}>로그아웃</button> 
            {error && <p style={{ color: 'red' }}>{error}</p>}
          </div>
        )}
      </div>

      {/* === 여행 관리 영역 (토큰이 있을 때만 보임) === */}
      {token && (
        <>
          {/* --- 새 여행 만들기 폼 (유지) --- */}
          <div className="card">
            <h3>새 여행 만들기</h3>
            <form onSubmit={handleCreateTrip}>
              <div className="form-group">
                <label>여행 제목:</label>
                <input type="text" value={newTripTitle} onChange={(e) => setNewTripTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label>시작일:</label>
                <input type="date" value={newTripStartDate} onChange={(e) => setNewTripStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>종료일:</label>
                <input type="date" value={newTripEndDate} onChange={(e) => setNewTripEndDate(e.target.value)} />
              </div>
              <button type="submit">여행 추가</button>
            </form>
          </div>

          {/* --- 내 여행 목록 --- */}
          <div className="card">
            <h3>내 여행 목록</h3>
            <ul className="trip-list">
              {trips.length > 0 ? (
                trips.map((trip) => (
                  <li key={trip.id}>
                    {/* (수정) 버튼 없는 .trip-info만 남김 */}
                    <div className="trip-info">
                      <Link to={`/trip/${trip.id}`}>{trip.title}</Link>
                      <p>
                        {trip.start_date || 'N/A'} ~ {trip.end_date || 'N/A'}
                      </p>
                    </div>
                    
                    {/* (제거) .trip-actions div 제거 */}
                  </li>
                ))
              ) : (
                <p>아직 생성된 여행이 없습니다.</p>
              )}
            </ul>
          </div>
        </>
      )}
    </>
  )
}