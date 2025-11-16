import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom' // 1. useNavigate 임포트
// 2. axios 삭제, useAuth 임포트
import { useAuth } from '../context/AuthContext' 
import '../App.css'
import { GoogleMap, useJsApiLoader, Marker, Autocomplete, Polyline } from '@react-google-maps/api';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// 3. API_URL과 api 인스턴스 모두 삭제 (AuthContext가 관리)

const mapContainerStyle = { width: '100%', height: '400px' };
const defaultCenter = { lat: 37.5665, lng: 126.9780 };
const libraries = ['places'];
const polylineOptions = {
  strokeColor: '#FF0000',
  strokeOpacity: 0.8,
  strokeWeight: 3,
};

export default function TripDetailPage() {
  // 4. AuthContext에서 필요한 전역 상태/함수 가져오기
  const { token, api, logout, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate(); // (추가) 로그아웃 시 홈으로 이동

  const { tripId } = useParams() 
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true) // 이 페이지 자체의 로딩 상태
  const [error, setError] = useState('')
  
  // (이하 로컬 상태는 이전과 동일)
  const [mapCenter, setMapCenter] = useState(defaultCenter); 
  const [autocomplete, setAutocomplete] = useState(null); 
  const [searchDay, setSearchDay] = useState(1); 
  const [searchMemo, setSearchMemo] = useState("");
  const [selectedDay, setSelectedDay] = useState(1);
  const [itemsForSelectedDay, setItemsForSelectedDay] = useState([]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: libraries
  })
  
  // 5. (수정) fetchTripDetails에서 로컬 토큰 관리 로직 제거
  const fetchTripDetails = () => {
    // AuthContext의 'api' 인스턴스는 이미 토큰을 가지고 있음
    setLoading(true);
    api.get(`/api/trips/${tripId}`)
      .then(response => {
        setTrip(response.data)
        setLoading(false)
        if (response.data.items.length > 0) {
          const lastItem = response.data.items[response.data.items.length - 1];
          if (lastItem.latitude && lastItem.longitude) {
            setMapCenter({ lat: lastItem.latitude, lng: lastItem.longitude });
          }
        }
      })
      .catch(err => {
        console.error('여행 상세 정보 로드 오류:', err)
        setError('여행 정보를 불러오지 못했습니다.')
        setLoading(false)
        // (중요) 401 오류(토큰 만료 등) 시 로그아웃 처리
        if (err.response && err.response.status === 401) {
          logout();
          navigate('/'); // 홈으로 이동
        }
      })
  }

  // 6. (수정) useEffect가 'token'에도 의존하도록 변경
  useEffect(() => {
    // 토큰이 있을 때만(로그인 상태) API 호출
    if (token) {
      fetchTripDetails()
    } else {
      // 토큰이 없으면(로그아웃 상태) 로딩 중지 및 에러 표시
      setLoading(false);
      setError("이 페이지에 접근하려면 로그인이 필요합니다.");
    }
  }, [tripId, token]) // tripId 또는 token이 바뀔 때마다 실행

  // --- Autocomplete 핸들러 (이전과 동일) ---
  const onLoad = (autocompleteInstance) => setAutocomplete(autocompleteInstance);
  const onPlaceChanged = () => { /* ... */ };

  // --- API 호출 핸들러 (401 오류 시 logout 추가) ---

  const handleAddPlace = async (e) => {
    e.preventDefault(); 
    if (autocomplete === null) { /* ... */ return; }
    const place = autocomplete.getPlace(); 
    if (!place || !place.geometry) { /* ... */ return; }
    
    const newItemData = {
      day: searchDay,
      place_name: place.name || "이름 없는 장소",
      address: place.formatted_address || null,
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
      memo: searchMemo || null,
      order_sequence: (trip?.items || []).filter(item => item.day === searchDay).length + 1
    };
    setError('');
    try {
      await api.post(`/api/trips/${tripId}/items`, newItemData);
      setSearchMemo("");
      fetchTripDetails(); // 목록 새로고침
    } catch (err) {
      setError("일정 추가에 실패했습니다.");
      if (err.response && err.response.status === 401) logout();
    }
  }

  const handleUpdateItemMemo = async (item) => {
    const newMemo = window.prompt("새 메모 입력:", item.memo || "");
    if (newMemo !== null) {
      setError('');
      try {
        await api.put(`/api/items/${item.id}`, { memo: newMemo });
        fetchTripDetails(); 
      } catch (err) {
        setError("메모 수정에 실패했습니다.");
        if (err.response && err.response.status === 401) logout();
      }
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("이 일정을 삭제하시겠습니까?")) return;
    setError('');
    try {
      await api.delete(`/api/items/${itemId}`);
      fetchTripDetails(); 
    } catch (err) {
      setError("일정 삭제에 실패했습니다.");
      if (err.response && err.response.status === 401) logout();
    }
  }
  
  const onDragEnd = (result) => {
    const { destination, source } = result;
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }

    const newItems = Array.from(itemsForSelectedDay);
    const [reorderedItem] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, reorderedItem);
    
    const updateData = newItems.map((item, index) => ({
      id: item.id,
      order_sequence: index + 1
    }));
    
    setItemsForSelectedDay(newItems); // 낙관적 업데이트

    api.post('/api/items/reorder', updateData)
      .then(response => {
        console.log('순서 변경 완료', response.data);
      })
      .catch(err => {
        setError("순서 변경에 실패했습니다. 페이지를 새로고침합니다.");
        fetchTripDetails(); // 실패 시 롤백
        if (err.response && err.response.status === 401) logout();
      });
  };

  // --- (useMemo, useEffect[trip, selectedDay], polylinePath 계산은 이전과 동일) ---
  const tripDays = useMemo(() => { /* ... */ }, [trip]);
  useEffect(() => { /* ... */ }, [trip, selectedDay]);
  const polylinePath = itemsForSelectedDay.filter(/* ... */).map(/* ... */);


  // --- 렌더링 (로딩 상태 수정) ---
  // 1. AuthContext 로딩 확인
  if (isAuthLoading) return <p>인증 정보 로딩 중...</p>
  // 2. Google Maps 스크립트 로딩 확인
  if (!isLoaded) return <p>지도 로딩 중...</p>
  // 3. (추가) 토큰이 없으면 접근 차단
  if (!token) return (
    <div>
      <p style={{ color: 'red' }}>{error || "로그인이 필요합니다."}</p>
      <Link to="/">로그인 페이지로 돌아가기</Link>
    </div>
  )
  // 4. 이 페이지의 데이터 로딩 확인
  if (loading) return <p>여행 정보 로딩 중...</p>
  // 5. 기타 에러
  if (error) return <p style={{ color: 'red' }}>{error}</p>
  if (!trip) return <p>여행 정보를 찾을 수 없습니다.</p>

  return (
    <div>
      <p><Link to="/">&larr; 내 여행 목록으로 돌아가기</Link></p>
      <h2>{trip.title}</h2>
      <p style={{ color: '#555', marginTop: '-10px' }}>
        ({trip.start_date} ~ {trip.end_date})
      </p>

      {/* --- 장소 추가 폼 --- */}
      <div className="card">
        <h3>새 일정 추가</h3>
        <form onSubmit={handleAddPlace}>
          <div className="form-group">
            <label>장소 검색:</label>
            <Autocomplete
              onLoad={onLoad}
              onPlaceChanged={onPlaceChanged}
            >
              <input
                type="text"
                placeholder="Google Maps에서 장소 검색..."
                style={{ width: '95%', maxWidth: 'none' }} // 폼 스타일 통일
              />
            </Autocomplete>
          </div>
          
          {/* Day와 Memo를 가로로 배치 */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Day:</label>
              <input 
                type="number" 
                value={searchDay} 
                onChange={(e) => setSearchDay(parseInt(e.target.value) || 1)} 
                min="1"
                style={{ width: '80px' }}
              />
            </div>
            <div className="form-group" style={{ flex: 3 }}>
              <label>메모:</label>
              <input 
                type="text"
                value={searchMemo}
                onChange={(e) => setSearchMemo(e.target.value)}
                placeholder=" (선택) 간단한 메모"
                style={{ width: '95%' }}
              />
            </div>
          </div>
          <button type="submit">일정 추가</button>
        </form>
      </div>

      {/* --- 날짜 선택 버튼 --- */}
      <div className="card">
        <strong>날짜 선택: </strong>
        {tripDays.map(day => (
          <button 
            key={day}
            onClick={() => setSelectedDay(day)}
            style={{ 
              margin: '0 5px', 
              fontWeight: selectedDay === day ? 'bold' : 'normal',
              backgroundColor: selectedDay === day ? '#e0e0e0' : '#f9f9f9',
              border: selectedDay === day ? '1px solid #aaa' : '1px solid #ccc',
            }}
          >
            Day {day}
          </button>
        ))}
      </div>

      {/* --- 세부 일정 및 지도 (새로운 CSS 레이아웃 적용) --- */}
      <div className="detail-layout">
        
        {/* 1. 세부 일정 목록 */}
        <div className="itinerary-column">
          <div className="card"> {/* card 스타일 적용 */}
            <h3>세부 일정 (Day {selectedDay})</h3> 
            
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId={`day-${selectedDay}`}>
                {(provided) => (
                  <ul
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    style={{ listStyle: 'none', padding: 0 }}
                  >
                    {itemsForSelectedDay.length > 0 ? (
                      itemsForSelectedDay.map((item, index) => (
                        <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                          {(provided) => (
                            // 1. dnd-item 클래스 적용
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="dnd-item" // CSS 클래스 적용
                              style={{ ...provided.draggableProps.style }} // D&D 스타일은 유지
                            >
                              <div 
                                onClick={() => item.latitude && setMapCenter({ lat: item.latitude, lng: item.longitude })}
                                style={{ cursor: 'pointer' }}
                              >
                                <strong>{item.place_name}</strong>
                                <p>{item.memo || item.address}</p>
                              </div>
                              {/* 2. dnd-item-actions 클래스 적용 */}
                              <div className="dnd-item-actions">
                                <button 
                                  onClick={() => handleUpdateItemMemo(item)}
                                  className="memo-edit-btn" // CSS 클래스 적용
                                  title="메모 수정"
                                >
                                  [메모 수정]
                                </button>
                                <button 
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="delete-btn" // CSS 클래스 적용
                                  title="일정 삭제"
                                >
                                  &times;
                                </button>
                              </div>
                            </li>
                          )}
                        </Draggable>
                      ))
                    ) : (
                      <p>Day {selectedDay}에 등록된 일정이 없습니다.</p>
                    )}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>

        {/* 2. 지도 */}
        <div className="map-column">
          <div className="card"> {/* card 스타일 적용 */}
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={12}
            >
              {itemsForSelectedDay.map(item => (
                item.latitude && item.longitude && (
                  <Marker
                    key={item.id}
                    position={{ lat: item.latitude, lng: item.longitude }}
                    title={item.place_name}
                  />
                )
              ))}
              <Polyline
                path={polylinePath}
                options={polylineOptions}
              />
            </GoogleMap>
          </div>
        </div>
      </div>
    </div>
  )
}