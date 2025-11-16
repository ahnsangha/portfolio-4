import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import '../App.css'
// 1. axios는 삭제하고, useAuth 훅을 임포트합니다.
import { useAuth } from '../context/AuthContext'

// 2. API_URL과 api 인스턴스를 모두 삭제합니다. (AuthContext가 관리)

export default function HomePage() {
  // 3. AuthContext에서 전역 상태와 함수를 가져옵니다.
  const { token, userData, api, login, logout, isLoading } = useAuth();

  // 4. 인증 관련 로컬 상태(token, userData)는 제거하고,
  //    로그인 폼 전용 상태만 남깁니다.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // 5. 이 페이지에서 관리할 데이터 상태 (이전과 동일)
  const [trips, setTrips] = useState([])
  const [newTripTitle, setNewTripTitle] = useState('')
  const [newTripStartDate, setNewTripStartDate] = useState('')
  const [newTripEndDate, setNewTripEndDate] = useState('')
  const [editingTripId, setEditingTripId] = useState(null);
  const [editingTripTitle, setEditingTripTitle] = useState("");

  // 6. (수정) 전역 userData가 변경될 때, 이 페이지의 로컬 trips 상태를 동기화합니다.
  useEffect(() => {
    if (userData) {
      // AuthContext가 불러온 내 정보(userData)에서 여행 목록을 가져옵니다.
      setTrips(userData.trips || []);
    } else {
      setTrips([]); // 로그아웃 시 목록 비우기
    }
  }, [userData]); // userData(from Context)가 바뀔 때마다 실행

  // 7. (수정) handleLogin 함수가 매우 간단해집니다.
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      // AuthContext의 login 함수를 호출합니다.
      await login(email, password);
      // 성공 시 setToken은 AuthContext가 알아서 처리합니다.
    } catch (err) {
      setError(err.response?.data?.detail || '로그인 실패');
    }
  }

  // 8. fetchMyInfo 함수는 이제 필요 없으므로 삭제합니다. (AuthContext가 담당)

  // 9. (수정) fetchMyTrips는 api.get('/api/trips')를 사용합니다.
  // (AuthContext의 'api' 인스턴스는 이미 토큰을 가지고 있습니다.)
  const fetchMyTrips = async () => {
    try {
      const response = await api.get('/api/trips')
      setTrips(response.data)
    } catch (err) {
      setError('여행 목록을 불러오지 못했습니다.');
      if (err.response && err.response.status === 401) {
        logout(); // 토큰 만료 시 AuthContext의 logout 호출
      }
    }
  }

  // 10. (수정) 다른 핸들러들도 401 오류 시 logout()을 호출하도록 수정합니다.
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

  const handleUpdateTripTitle = async (tripId) => {
    if (!editingTripTitle) { setError("여행 제목을 입력해주세요."); return; }
    setError('');
    try {
      await api.put(`/api/trips/${tripId}`, { title: editingTripTitle });
      setEditingTripId(null);
      setEditingTripTitle("");
      fetchMyTrips();
    } catch (err) {
      setError("여행 제목 수정에 실패했습니다.");
      if (err.response && err.response.status === 401) logout();
    }
  }

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm("정말로 이 여행을 삭제하시겠습니까?")) return;
    setError('');
    try {
      await api.delete(`/api/trips/${tripId}`); 
      fetchMyTrips(); 
    } catch (err) {
      setError("여행 삭제에 실패했습니다.");
      if (err.response && err.response.status === 401) logout();
    }
  }
  
  // (추가) AuthContext가 로딩 중일 때
  if (isLoading) {
    return <p>로딩 중...</p>
  }

  // 11. (수정) return 문에서 전역 token, userData, logout을 사용합니다.
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
            <button onClick={logout}>로그아웃</button> {/* setToken(null) -> logout() */}
            {error && <p style={{ color: 'red' }}>{error}</p>}
          </div>
        )}
      </div>

      {/* === 여행 관리 영역 (토큰이 있을 때만 보임) === */}
      {token && (
        <>
          {/* --- 새 여행 만들기 폼 --- */}
          <div className="card">
            <h3>새 여행 만들기</h3>
            <form onSubmit={handleCreateTrip}>
              {/* (폼 내부는 CSS 적용한 이전 코드와 동일) */}
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
                    {/* (목록 내부는 CSS 적용한 이전 코드와 동일) */}
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
                        <div className="trip-info">
                          <Link to={`/trip/${trip.id}`}>{trip.title}</Link>
                          <p>{trip.start_date || 'N/A'} ~ {trip.end_date || 'N/A'}</p>
                        </div>
                        <div className="trip-actions">
                          <button onClick={() => { setEditingTripId(trip.id); setEditingTripTitle(trip.title); }}>
                            수정
                          </button>
                          <button onClick={() => handleDeleteTrip(trip.id)} style={{ borderColor: 'red', color: 'red' }}>
                            삭제
                          </button>
                        </div>
                      </>
                    )}
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