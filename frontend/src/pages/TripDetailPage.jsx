import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext' 
import '../App.css'
import { GoogleMap, useJsApiLoader, Marker, Autocomplete, Polyline } from '@react-google-maps/api';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Modal from 'react-modal'; 

// (지도 스타일, 기본 위치 설정은 동일)
const mapContainerStyle = { width: '100%', height: '400px' };
const defaultCenter = { lat: 37.5665, lng: 126.9780 };

// Google Maps API 로더가 'places' 라이브러리도 불러오도록 설정
const libraries = ['places'];

const polylineOptions = {
  strokeColor: '#FF0000', // 선 색상
  strokeOpacity: 0.8,     // 선 불투명도
  strokeWeight: 3,        // 선 굵기
};

export default function TripDetailPage() {
  // 1. 전역 상태 및 훅
  const { token, api, logout, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate(); 
  const { tripId } = useParams() 
  
  // 2. 이 페이지의 로컬 상태
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true) 
  const [error, setError] = useState('')
  const [mapCenter, setMapCenter] = useState(defaultCenter); 
  const [autocomplete, setAutocomplete] = useState(null); 
  const [searchDay, setSearchDay] = useState(1); 
  const [searchMemo, setSearchMemo] = useState("");
  const [selectedDay, setSelectedDay] = useState(1);
  const [itemsForSelectedDay, setItemsForSelectedDay] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null); // Autocomplete에서 선택된 장소
  const autocompleteInputRef = useRef(null); // Autocomplete 입력창 DOM

  // 3. 메모 수정 모달 상태
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState(null); 
  const [modalEditMemo, setModalEditMemo] = useState(""); 

  // 4. Google Maps 스크립트 로드
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: libraries
  })
  
  // 5. API 호출 함수: 여행 상세 정보 불러오기
  const fetchTripDetails = () => {
    // AuthContext의 'api' 인스턴스는 이미 토큰을 가지고 있음
    setLoading(true);
    api.get(`/api/trips/${tripId}`)
      .then(response => {
        setTrip(response.data)
        setLoading(false)
        setError('') // 성공 시 에러 초기화
        
        // 지도 중심 설정 (마지막 항목 기준)
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
        if (err.response && err.response.status === 401) {
          logout();
          navigate('/'); // 토큰 만료 시 홈으로
        }
      })
  }

  // 6. 페이지 로드 시 (또는 tripId/token 변경 시) 데이터 호출
  useEffect(() => {
    if (token) {
      fetchTripDetails()
    } else {
      setLoading(false);
      setError("이 페이지에 접근하려면 로그인이 필요합니다.");
    }
  }, [tripId, token])

  // 7. Autocomplete 핸들러
  const onLoad = (autocompleteInstance) => setAutocomplete(autocompleteInstance);
  
  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      setSelectedPlace(place); // 선택된 장소를 state에 저장
    } else {
      console.log('Autocomplete is not loaded yet!');
    }
  }

  // 8. "일정 추가" 핸들러
  const handleAddPlace = async (e) => {
    e.preventDefault(); 
    
    const place = selectedPlace; // state에서 가져옴
    
    if (!place || !place.geometry || !place.geometry.location) {
      setError('Google Maps에서 장소를 선택해주세요.');
      return;
    }

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
      
      // 폼 초기화
      setSearchMemo("");
      setSelectedPlace(null);
      if (autocompleteInputRef.current) {
        autocompleteInputRef.current.value = "";
      }
      
      fetchTripDetails(); // 목록 새로고침
      
    } catch (err) {
      setError("일정 추가에 실패했습니다.");
      if (err.response && err.response.status === 401) logout();
    }
  }

  // 9. 메모 수정 모달 열기/닫기
  const openMemoModal = (item) => {
    setCurrentItemToEdit(item);
    setModalEditMemo(item.memo || "");
    setIsMemoModalOpen(true);
    setError(''); 
  }

  const closeMemoModal = () => {
    setIsMemoModalOpen(false);
    setCurrentItemToEdit(null);
    setModalEditMemo("");
  }

  // 10. "메모 수정" 핸들러 (모달 제출)
  const handleUpdateItemMemo = async (e) => {
    e.preventDefault();
    if (!currentItemToEdit) return;
    setError('');

    try {
      await api.put(`/api/items/${currentItemToEdit.id}`, {
        memo: modalEditMemo 
      });
      closeMemoModal();
      fetchTripDetails(); 
    } catch (err) {
      setError("메모 수정에 실패했습니다.");
      if (err.response && err.response.status === 401) logout();
    }
  }

  // 11. "일정 삭제" 핸들러
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
  
  // 12. 여행 일차(Day) 목록 계산
  const tripDays = useMemo(() => {
    if (!trip) return [1];
    const days = new Set(trip.items.map(item => item.day));
    if (days.size === 0) return [1];
    return Array.from(days).sort((a, b) => a - b);
  }, [trip]);

  // 13. 선택된 날짜의 일정 목록 상태 업데이트
  useEffect(() => {
    if (!trip) {
      setItemsForSelectedDay([]);
      return;
    }
    const filteredAndSortedItems = trip.items
      .filter(item => item.day === selectedDay)
      .sort((a, b) => a.order_sequence - b.order_sequence);
    setItemsForSelectedDay(filteredAndSortedItems);
  }, [trip, selectedDay]);

  // 14. Polyline 경로 계산
  const polylinePath = useMemo(() => {
    return itemsForSelectedDay
      .filter(item => item.latitude && item.longitude)
      .map(item => ({ lat: item.latitude, lng: item.longitude }));
  }, [itemsForSelectedDay]);

  // 15. D&D 드래그 종료 핸들러
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

  // --- 렌더링 로직 ---
  if (isAuthLoading) return <p>인증 정보 로딩 중...</p>
  if (!isLoaded) return <p>지도 로딩 중...</p>
  if (!token) return (
    <div>
      <p style={{ color: 'red' }}>{error || "로그인이 필요합니다."}</p>
      <Link to="/">로그인 페이지로 돌아가기</Link>
    </div>
  )
  if (loading) return <p>여행 정보 로딩 중...</p>
  
  // (수정) !trip일 때만 error를 페이지 상단에 표시
  if (!trip) {
     return <p style={{ color: 'red' }}>{error || "여행 정보를 찾을 수 없습니다."}</p>
  }

  // --- 메인 렌더링 ---
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
                ref={autocompleteInputRef}
                type="text"
                placeholder="Google Maps에서 장소 검색..."
                style={{ width: '95%', maxWidth: 'none' }}
              />
            </Autocomplete>
          </div>
          
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
        
        {/* 오류 메시지를 폼 내부에 표시 */}
        {error && !isMemoModalOpen && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
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

      {/* --- 세부 일정 및 지도 --- */}
      <div className="detail-layout">
        
        {/* 1. 세부 일정 목록 (D&D) */}
        <div className="itinerary-column">
          <div className="card">
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
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="dnd-item"
                              style={{ ...provided.draggableProps.style }}
                            >
                              <div 
                                onClick={() => item.latitude && setMapCenter({ lat: item.latitude, lng: item.longitude })}
                                style={{ cursor: 'pointer' }}
                              >
                                <strong>{item.place_name}</strong>
                                <p>{item.memo || item.address}</p>
                              </div>
                              <div className="dnd-item-actions">
                                <button
                                  onClick={() => openMemoModal(item)}
                                  className="memo-edit-btn"
                                  title="메모 수정"
                                >
                                  [메모 수정]
                                </button>
                                <button 
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="delete-btn"
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
          <div className="card">
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

      {/* --- 세부 일정 메모 수정 모달 --- */}
      <Modal
        isOpen={isMemoModalOpen}
        onRequestClose={closeMemoModal}
        className="ModalContent"
        overlayClassName="ReactModal__Overlay"
        contentLabel="세부 일정 메모 수정"
      >
        <h2>메모 수정</h2>
        <form onSubmit={handleUpdateItemMemo}>
          <div className="form-group">
            <label>메모 (비워도 됩니다):</label>
            <input
              type="text"
              value={modalEditMemo}
              onChange={(e) => setModalEditMemo(e.target.value)}
              placeholder="간단한 메모 입력..."
              autoFocus
            />
          </div>
          
          {/* 모달 내 에러 메시지 */}
          {error && isMemoModalOpen && <p style={{ color: 'red' }}>{error}</p>}

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={closeMemoModal}
            >
              취소
            </button>
            <button type="submit">저장</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}