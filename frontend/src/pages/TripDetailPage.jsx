import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext' 
import '../App.css'
import { GoogleMap, useJsApiLoader, Marker, Autocomplete, Polyline } from '@react-google-maps/api';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Modal from 'react-modal'; 

// --- (1) 컴포넌트 바깥에는 '고정된 값'만 둡니다 ---
const mapContainerStyle = { width: '100%', height: '400px' };
const defaultCenter = { lat: 37.5665, lng: 126.9780 };
const libraries = ['places'];

// (중요) 여기에 있던 polylineOptions는 삭제하고 컴포넌트 안으로 이동했습니다.

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
  const [selectedPlace, setSelectedPlace] = useState(null); 
  const autocompleteInputRef = useRef(null); 

  // 3. '일정' 수정 모달 상태
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState(null); 
  const [modalEditMemo, setModalEditMemo] = useState(""); 
  const [modalEditDay, setModalEditDay] = useState(1); 

  // 4. 여행 '정보' 수정 모달 상태
  const [isTripEditModalOpen, setIsTripEditModalOpen] = useState(false);
  const [modalEditTitle, setModalEditTitle] = useState("");
  const [modalEditStartDate, setModalEditStartDate] = useState("");
  const [modalEditEndDate, setModalEditEndDate] = useState("");

  // 5. 지도-목록 연동 하이라이트 상태
  const [highlightedItemId, setHighlightedItemId] = useState(null);

  // 6. Google Maps 스크립트 로드
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: libraries
  })

  // --- (2) useMemo를 사용하는 polylineOptions는 반드시 컴포넌트 '안'에 있어야 합니다 ---
  const polylineOptions = useMemo(() => {
    // 지도가 아직 로딩되지 않았으면 기본 옵션만 반환 (오류 방지)
    if (!isLoaded || !window.google) {
      return {
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 5,
      };
    }

    // 지도가 로딩되면 화살표(Symbol)가 포함된 옵션 반환
    return {
      strokeColor: '#FF0000',
      strokeOpacity: 0.8,
      strokeWeight: 5, // 선 굵기
      icons: [
        {
          // 구글 지도 기본 화살표 심볼 사용
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            strokeColor: '#FF0000', // 화살표 색상
            strokeOpacity: 1,
            scale: 3, // 화살표 크기
          },
          offset: '0',      // 시작점부터
          repeat: '100px',  // 100px 간격으로 화살표 반복 (너무 촘촘하면 지저분해 보임)
        },
      ],
    };
  }, [isLoaded]);
  
  // 7. API 호출 함수: fetchTripDetails
  const fetchTripDetails = () => {
    setLoading(true);
    api.get(`/api/trips/${tripId}`)
      .then(response => {
        setTrip(response.data)
        setLoading(false)
        setError('') 
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
          navigate('/'); 
        }
      })
  }

  // 8. 페이지 로드 시 데이터 호출
  useEffect(() => {
    if (token) {
      fetchTripDetails()
    } else {
      setLoading(false);
      setError("이 페이지에 접근하려면 로그인이 필요합니다.");
    }
  }, [tripId, token])

  // 9. Autocomplete 핸들러
  const onLoad = (autocompleteInstance) => setAutocomplete(autocompleteInstance);
  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      setSelectedPlace(place); 
    } else {
      console.log('Autocomplete is not loaded yet!');
    }
  }

  // 10. "일정 추가" 핸들러
  const handleAddPlace = async (e) => {
    e.preventDefault(); 
    const place = selectedPlace; 
    
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
      const response = await api.post(`/api/trips/${tripId}/items`, newItemData);
      setSearchMemo("");
      setSelectedPlace(null);
      if (autocompleteInputRef.current) {
        autocompleteInputRef.current.value = "";
      }
      fetchTripDetails(); 
      setHighlightedItemId(response.data.id); 
    } catch (err) {
      setError("일정 추가에 실패했습니다.");
      if (err.response && err.response.status === 401) logout();
    }
  }

  // 11. '일정' 수정 모달 열기/닫기
  const openMemoModal = (item) => {
    setCurrentItemToEdit(item);
    setModalEditMemo(item.memo || "");
    setModalEditDay(item.day); 
    setIsMemoModalOpen(true);
    setError(''); 
  }

  const closeMemoModal = () => {
    setIsMemoModalOpen(false);
    setCurrentItemToEdit(null);
    setModalEditMemo("");
    setModalEditDay(1); 
  }

  // 12. "일정 수정" 핸들러
  const handleUpdateItem = async (e) => { 
    e.preventDefault();
    if (!currentItemToEdit) return;
    setError('');

    try {
      await api.put(`/api/items/${currentItemToEdit.id}`, {
        memo: modalEditMemo,
        day: modalEditDay 
      });
      closeMemoModal();
      fetchTripDetails(); 
    } catch (err) {
      setError("일정 수정에 실패했습니다."); 
      if (err.response && err.response.status === 401) logout();
    }
  }

  // 13. "일정 삭제" 핸들러
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
  
  // 14. 여행 '정보' 수정 모달 열기/닫기
  const openTripEditModal = () => {
    if (!trip) return;
    setModalEditTitle(trip.title);
    setModalEditStartDate(trip.start_date || '');
    setModalEditEndDate(trip.end_date || '');
    setIsTripEditModalOpen(true);
    setError(''); 
  }

  const closeTripEditModal = () => {
    setIsTripEditModalOpen(false);
    setModalEditTitle("");
    setModalEditStartDate("");
    setModalEditEndDate("");
  }

  // 15. 여행 '정보' 수정 핸들러
  const handleUpdateTripDetails = async (e) => {
    e.preventDefault();
    if (!modalEditTitle) {
      setError("여행 제목을 입력해주세요.");
      return;
    }
    
    setError('');
    try {
      await api.put(`/api/trips/${tripId}`, {
        title: modalEditTitle,
        start_date: modalEditStartDate || null,
        end_date: modalEditEndDate || null
      });
      closeTripEditModal();
      fetchTripDetails(); 
    } catch (err) {
      setError("여행 정보 수정에 실패했습니다.");
      if (err.response && err.response.status === 401) logout();
    }
  }

  // 16. 여행 '자체' 삭제 핸들러
  const handleDeleteTrip = async () => {
    if (!window.confirm("정말로 이 여행 전체를 삭제하시겠습니까?\n모든 세부 일정이 함께 삭제됩니다.")) return;
    
    setError('');
    try {
      await api.delete(`/api/trips/${tripId}`);
      alert("여행이 삭제되었습니다.");
      navigate('/'); 
    } catch (err) {
      setError("여행 삭제에 실패했습니다.");
      if (err.response && err.response.status === 401) logout();
    }
  }

  // 17. 여행 일차(Day) 목록 계산
  const tripDays = useMemo(() => {
    if (!trip) return [1];
    const days = new Set(trip.items.map(item => item.day));
    days.add(selectedDay); 
    if (days.size === 0) return [1];
    return Array.from(days).sort((a, b) => a - b);
  }, [trip, selectedDay]); 

  // 18. 선택된 날짜의 일정 목록 상태 업데이트
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

  // 19. Polyline 경로 계산
  const polylinePath = useMemo(() => {
    return itemsForSelectedDay
      .filter(item => item.latitude && item.longitude)
      .map(item => ({ lat: item.latitude, lng: item.longitude }));
  }, [itemsForSelectedDay]);

  // 20. D&D 드래그 종료 핸들러
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
    setItemsForSelectedDay(newItems); 
    api.post('/api/items/reorder', updateData)
      .then(response => {
        console.log('순서 변경 완료', response.data);
      })
      .catch(err => {
        setError("순서 변경에 실패했습니다. 페이지를 새로고침합니다.");
        fetchTripDetails(); 
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
  
  if (!trip) {
     return <p style={{ color: 'red' }}>{error || "여행 정보를 찾을 수 없습니다."}</p>
  }

  // --- 메인 렌더링 ---
  return (
    <div>
      <p><Link to="/">&larr; 내 여행 목록으로 돌아가기</Link></p>
      <h2>{trip.title}</h2>
      <p style={{ color: '#555', marginTop: '-10px' }}>
        ({trip.start_date || 'N/A'} ~ {trip.end_date || 'N/A'})
      </p>

      <div className="trip-actions" style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
        <button onClick={openTripEditModal}>
          여행 정보 수정 (제목/날짜)
        </button>
        <button 
          onClick={handleDeleteTrip}
          style={{ borderColor: 'red', color: 'red', marginLeft: '0.5rem' }}
        >
          여행 전체 삭제
        </button>
      </div>

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
        {error && !isMemoModalOpen && !isTripEditModalOpen && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      </div>

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
                              className={
                                item.id === highlightedItemId 
                                ? "dnd-item dnd-item-highlighted" 
                                : "dnd-item"
                              }
                              style={{ ...provided.draggableProps.style }}
                            >
                              <div 
                                onClick={() => {
                                  if (item.latitude) {
                                    setMapCenter({ lat: item.latitude, lng: item.longitude });
                                  }
                                  setHighlightedItemId(item.id);
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                <strong>{item.place_name}</strong>
                                <p>{item.memo || item.address}</p>
                              </div>
                              <div className="dnd-item-actions">
                                <button
                                  onClick={() => openMemoModal(item)}
                                  className="memo-edit-btn"
                                  title="일정 수정"
                                >
                                  [일정 수정]
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
              onClick={() => setHighlightedItemId(null)} 
            >
              {itemsForSelectedDay.map(item => (
                item.latitude && item.longitude && (
                  <Marker
                    key={item.id}
                    position={{ lat: item.latitude, lng: item.longitude }}
                    title={item.place_name}
                    onClick={() => setHighlightedItemId(item.id)}
                  />
                )
              ))}
              
              {/* 라이브러리가 path 변경을 감지하여 자동으로 선을 다시 그립니다. */}
                <Polyline
                  path={polylinePath}
                  options={polylineOptions}
                />

            </GoogleMap>
          </div>
        </div>
      </div>

      {/* --- 세부 일정 수정 모달 --- */}
      <Modal
        isOpen={isMemoModalOpen}
        onRequestClose={closeMemoModal}
        className="ModalContent"
        overlayClassName="ReactModal__Overlay"
        contentLabel="세부 일정 수정"
      >
        <h2>세부 일정 수정</h2> 
        <form onSubmit={handleUpdateItem}> 
          <div className="form-group">
            <label>Day:</label>
            <input
              type="number"
              value={modalEditDay}
              onChange={(e) => setModalEditDay(parseInt(e.target.value) || 1)}
              min="1"
              style={{ width: '100px' }}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>메모 (비워도 됩니다):</label>
            <input
              type="text"
              value={modalEditMemo}
              onChange={(e) => setModalEditMemo(e.target.value)}
              placeholder="간단한 메모 입력..."
            />
          </div>
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

      {/* --- 여행 정보 수정 모달 --- */}
      <Modal
        isOpen={isTripEditModalOpen}
        onRequestClose={closeTripEditModal}
        className="ModalContent"
        overlayClassName="ReactModal__Overlay"
        contentLabel="여행 정보 수정"
      >
        <h2>여행 정보 수정</h2>
        <form onSubmit={handleUpdateTripDetails}>
          <div className="form-group">
            <label>여행 제목:</label>
            <input
              type="text"
              value={modalEditTitle}
              onChange={(e) => setModalEditTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>시작일:</label>
            <input
              type="date"
              value={modalEditStartDate}
              onChange={(e) => setModalEditStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>종료일:</label>
            <input
              type="date"
              value={modalEditEndDate}
              onChange={(e) => setModalEditEndDate(e.target.value)}
            />
          </div>
          {error && isTripEditModalOpen && <p style={{ color: 'red' }}>{error}</p>}
          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={closeTripEditModal}
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