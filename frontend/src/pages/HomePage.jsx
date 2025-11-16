import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import '../App.css'
import { useAuth } from '../context/AuthContext'
import Modal from 'react-modal'; // 1. react-modal 임포트

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
  
  // 2. (수정) 인라인 수정 상태 -> 모달 수정 상태로 변경
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentTripToEdit, setCurrentTripToEdit] = useState(null); // 수정할 trip 객체
  const [modalEditTitle, setModalEditTitle] = useState(""); // 모달 안의 input 값

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

  // 3. (추가) 모달 열기/닫기 헬퍼 함수
  const openEditModal = (trip) => {
    setCurrentTripToEdit(trip);      // 현재 수정할 trip 정보를 상태에 저장
    setModalEditTitle(trip.title);  // 모달 input의 초기값을 현재 제목으로 설정
    setIsEditModalOpen(true);       // 모달 열기
    setError('');                   // 이전 에러 메시지 초기화
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setCurrentTripToEdit(null);
    setModalEditTitle("");
  }

  // 4. (수정) 여행(Trip) 제목 수정 핸들러 -> 모달 폼 제출용으로 변경
  const handleUpdateTripTitle = async (e) => {
    e.preventDefault(); // 폼 제출
    
    if (!modalEditTitle) {
      setError("여행 제목을 입력해주세요.");
      return;
    }
    if (!currentTripToEdit) return; // 방어 코드

    setError('');

    try {
      // PUT /api/trips/{trip_id} 호출
      await api.put(`/api/trips/${currentTripToEdit.id}`, {
        title: modalEditTitle // 모달 input의 값 사용
      });

      // 성공 시: 모달 닫기 및 목록 새로고침
      closeEditModal();
      fetchMyTrips();

    } catch (err) {
      console.error("여행 제목 수정 오류:", err);
      setError("여행 제목 수정에 실패했습니다.");
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
                    {/* (수정) 인라인 편집 로직(ternary) 제거 */}
                    <div className="trip-info">
                      <Link to={`/trip/${trip.id}`}>{trip.title}</Link>
                      <p>
                        {trip.start_date || 'N/A'} ~ {trip.end_date || 'N/A'}
                      </p>
                    </div>
                    
                    <div className="trip-actions">
                      {/* (수정) 수정 버튼 onClick이 모달을 열도록 변경 */}
                      <button 
                        onClick={() => openEditModal(trip)}
                      >
                        수정
                      </button>
                      <button 
                        onClick={() => handleDeleteTrip(trip.id)}
                        style={{ borderColor: 'red', color: 'red' }}
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))
              ) : (
                <p>아직 생성된 여행이 없습니다.</p>
              )}
            </ul>
          </div>
        </>
      )}

      {/* --- (새로 추가) 여행 제목 수정 모달 --- */}
      <Modal
        isOpen={isEditModalOpen}
        onRequestClose={closeEditModal}
        className="ModalContent"        // App.css에 정의한 클래스
        overlayClassName="ReactModal__Overlay" // App.css에 정의한 클래스
        contentLabel="여행 제목 수정"
      >
        <h2>여행 제목 수정</h2>
        <form onSubmit={handleUpdateTripTitle}>
          <div className="form-group">
            <label>새 여행 제목:</label>
            <input
              type="text"
              value={modalEditTitle}
              onChange={(e) => setModalEditTitle(e.target.value)}
              autoFocus
            />
          </div>
          
          {/* 모달 내 에러 메시지 */}
          {error && <p style={{ color: 'red' }}>{error}</p>}

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={closeEditModal}
            >
              취소
            </button>
            <button type="submit">저장</button>
          </div>
        </form>
      </Modal>
    </>
  )
}