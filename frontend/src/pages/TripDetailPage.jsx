import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import '../App.css'
import { GoogleMap, useJsApiLoader, Marker, Autocomplete, Polyline } from '@react-google-maps/api';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const API_URL = 'http://127.0.0.1:8000'

// (axios 인스턴스, 지도 스타일, 기본 위치 설정은 동일)
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
})
const mapContainerStyle = { width: '100%', height: '400px' };
const defaultCenter = { lat: 37.5665, lng: 126.9780 };

// 3. Google Maps API 로더가 'places' 라이브러리도 불러오도록 수정합니다.
const libraries = ['places'];

const polylineOptions = {
  strokeColor: '#FF0000', // 선 색상
  strokeOpacity: 0.8,     // 선 불투명도
  strokeWeight: 3,        // 선 굵기
};

export default function TripDetailPage() {
  const { tripId } = useParams() 
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapCenter, setMapCenter] = useState(defaultCenter); 
  const [autocomplete, setAutocomplete] = useState(null); 
  const [searchDay, setSearchDay] = useState(1); 
  const [searchMemo, setSearchMemo] = useState("");
  const [selectedDay, setSelectedDay] = useState(1);
  const [itemsForSelectedDay, setItemsForSelectedDay] = useState([]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: libraries // 4. 수정된 libraries 변수 사용
  })
  
  // --- 여행 정보(세부 일정 포함)를 다시 불러오는 함수 ---
  const fetchTripDetails = () => {
    // (임시) 토큰 관리
    const token = localStorage.getItem('MY_APP_TOKEN') 
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      setError('로그인이 필요합니다. (임시 메시지)')
      setLoading(false)
      return
    }

    api.get(`/api/trips/${tripId}`)
      .then(response => {
        setTrip(response.data)
        setLoading(false)
        
        // (지도 중심 설정 로직은 동일)
        if (response.data.items.length > 0) {
          const firstItem = response.data.items[response.data.items.length - 1]; // 마지막 항목으로 중심 설정
          if (firstItem.latitude && firstItem.longitude) {
            setMapCenter({
              lat: firstItem.latitude,
              lng: firstItem.longitude
            });
          }
        }
      })
      .catch(err => {
        console.error('여행 상세 정보 로드 오류:', err)
        setError('여행 정보를 불러오지 못했습니다.')
        setLoading(false)
      })
  }

  // 5. 페이지 로드 시 여행 정보 최초 호출
  useEffect(() => {
    fetchTripDetails() 
  }, [tripId])

  // --- Autocomplete 이벤트 핸들러 ---
  const onLoad = (autocompleteInstance) => {
    setAutocomplete(autocompleteInstance);
  }

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      console.log(autocomplete.getPlace()); // 장소 선택 시 콘솔에 정보 출력
    } else {
      console.log('Autocomplete is not loaded yet!');
    }
  }

  // --- "일정 추가" 버튼 핸들러 ---
  const handleAddPlace = async (e) => {
    e.preventDefault(); // 폼 제출 방지
    
    if (autocomplete === null) {
      setError('장소 검색기가 로드되지 않았습니다.');
      return;
    }
    
    const place = autocomplete.getPlace(); // 사용자가 선택한 장소 정보
    
    if (!place || !place.geometry || !place.geometry.location) {
      setError('Google Maps에서 장소를 선택해주세요.');
      return;
    }

    // 백엔드 API로 보낼 데이터
    const newItemData = {
      day: searchDay,
      place_name: place.name || "이름 없는 장소",
      address: place.formatted_address || null,
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
      memo: searchMemo || null,
      // (중요) order_sequence 계산: 현재 trip 객체에서 같은 날(day)의 항목 수를 셉니다.
      order_sequence: trip.items.filter(item => item.day === searchDay).length + 1
    };
    
    setError('');

    try {
      // API 호출 (POST /api/trips/{trip_id}/items)
      await api.post(`/api/trips/${tripId}/items`, newItemData);
      
      // 성공 시: 폼 초기화 및 여행 정보(목록) 새로고침
      setSearchMemo("");
      // (참고: Autocomplete 입력창은 수동으로 지워야 할 수 있습니다)
      
      fetchTripDetails(); // 지도와 목록을 새로고침
      
    } catch (err) {
      console.error("일정 추가 오류:", err);
      setError("일정 추가에 실패했습니다.");
    }
  }

  const handleUpdateItemMemo = async (item) => {
    // window.prompt로 사용자에게 새 메모를 입력받음
    const newMemo = window.prompt("새 메모 입력 (비우려면 공백):", item.memo || "");

    // 사용자가 "취소"를 누르지 않았을 때만 (null이 아닐 때)
    if (newMemo !== null) {
      setError('');
      try {
        // PUT /api/items/{item_id} 호출
        await api.put(`/api/items/${item.id}`, {
          memo: newMemo // 새 메모만 전송
        });
        
        // 성공 시: 목록 새로고침
        fetchTripDetails(); 

      } catch (err) {
        console.error("일정 메모 수정 오류:", err);
        setError("메모 수정에 실패했습니다.");
      }
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("이 일정을 삭제하시겠습니까?")) {
      return;
    }
    
    setError('');
    
    try {
      // DELETE /api/items/{item_id} 호출
      await api.delete(`/api/items/${itemId}`);
      
      // 성공 시: 여행 정보(목록) 새로고침
      fetchTripDetails(); 
      
    } catch (err) {
      console.error("일정 삭제 오류:", err);
      setError("일정 삭제에 실패했습니다.");
    }
  }

  // --- 여행 일차(Day) 계산 ---
  // 여행에 등록된 모든 Day 번호들을 Set으로 추출 (예: [1, 2, 3])
  const tripDays = useMemo(() => {
    if (!trip) return [1];
    const days = new Set(trip.items.map(item => item.day));
    if (days.size === 0) return [1]; // 일정이 없으면 1일차만 표시
    return Array.from(days).sort((a, b) => a - b);
  }, [trip]); // trip 데이터가 바뀔 때만 다시 계산

  // trip 또는 selectedDay가 바뀔 때, itemsForSelectedDay '상태'를 업데이트
  useEffect(() => {
    if (!trip) {
      setItemsForSelectedDay([]);
      return;
    }
    const filteredAndSortedItems = trip.items
      .filter(item => item.day === selectedDay)
      .sort((a, b) => a.order_sequence - b.order_sequence);
    setItemsForSelectedDay(filteredAndSortedItems);
  }, [trip, selectedDay]); // trip 또는 selectedDay가 바뀔 때 실행


  // Polyline 경로는 이제 useMemo가 아닌, itemsForSelectedDay 상태 기반
  const polylinePath = itemsForSelectedDay
    .filter(item => item.latitude && item.longitude)
    .map(item => ({ lat: item.latitude, lng: item.longitude }));


  // --- (새로 추가) D&D 드래그 종료 시 호출되는 함수 ---
  const onDragEnd = (result) => {
    const { destination, source } = result;

    // 1. 드롭된 위치가 유효하지 않으면 (목록 밖) 무시
    if (!destination) {
      return;
    }
    // 2. 위치가 변경되지 않았으면 무시
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // 3. (프론트엔드) 순서가 변경된 새 목록을 즉시 만듦 (React 상태 업데이트)
    const newItems = Array.from(itemsForSelectedDay);
    // 3-1. 드래그 시작한 아이템을 목록에서 제거
    const [reorderedItem] = newItems.splice(source.index, 1);
    // 3-2. 드롭된 위치에 다시 삽입
    newItems.splice(destination.index, 0, reorderedItem);
    
    // 4. (백엔드 API용) 새 순서(order_sequence)가 반영된 데이터 생성
    // (간단하게 index를 새 order_sequence로 사용)
    const updateData = newItems.map((item, index) => ({
      id: item.id,
      order_sequence: index + 1 // 1부터 시작
    }));
    
    // 5. (프론트엔드) 즉각적인 UI/지도(Polyline) 반응을 위해 상태 업데이트
    // DB 업데이트가 실패하면 원래대로 돌려야 하지만, 여기서는 '낙관적 업데이트' 수행
    setItemsForSelectedDay(newItems);

    // 6. (백엔드) API 호출 (POST /api/items/reorder)
    api.post('/api/items/reorder', updateData)
      .then(response => {
        // 성공 시 (선택적): DB에서 최신 데이터를 다시 불러와 동기화
        console.log('순서 변경 완료', response.data);
        // fetchTripDetails(); // (주석 처리: 낙관적 업데이트로 충분할 수 있음)
      })
      .catch(err => {
        console.error("순서 변경 오류:", err);
        setError("순서 변경에 실패했습니다. 페이지를 새로고침합니다.");
        // 실패 시 원래 순서로 되돌리기 (또는 새로고침)
        fetchTripDetails(); 
      });
  };


  // --- 렌더링 ---
  if (!isLoaded) return <p>지도 로딩 중...</p>
  if (loading) return <p>여행 정보 로딩 중...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>
  if (!trip) return <p>여행 정보를 찾을 수 없습니다.</p>

  return (
    <div>
      <p><Link to="/">&larr; 내 여행 목록으로 돌아가기</Link></p>
      <h2>{trip.title}</h2>
      <p>({trip.start_date} ~ {trip.end_date})</p>

      {/* --- 장소 추가 폼 (새로 추가) --- */}
      <div className="card">
        <h3>새 일정 추가</h3>
        <form onSubmit={handleAddPlace}>
          <div>
            {/* 1. 장소 검색 (Autocomplete) */}
            <Autocomplete
              onLoad={onLoad}
              onPlaceChanged={onPlaceChanged}
            >
              <input
                type="text"
                placeholder="Google Maps에서 장소 검색..."
                style={{ width: '300px' }}
              />
            </Autocomplete>
          </div>
          <div>
            <label>Day: </label>
            <input 
              type="number" 
              value={searchDay} 
              onChange={(e) => setSearchDay(parseInt(e.target.value) || 1)} 
              min="1"
              style={{ width: '50px' }}
            />
            <label style={{ marginLeft: '10px' }}>메모: </label>
            <input 
              type="text"
              value={searchMemo}
              onChange={(e) => setSearchMemo(e.target.value)}
              placeholder=" (선택) 간단한 메모"
            />
          </div>
          <button type="submit">일정 추가</button>
        </form>
        {/* --- (새로 추가) 날짜 선택 버튼 --- */}
        <div className="card">
            <strong>날짜 선택: </strong>
            {tripDays.map(day => (
            <button 
                key={day}
                onClick={() => setSelectedDay(day)}
                // 현재 선택된 날짜는 강조 표시
                style={{ 
                margin: '0 5px', 
                fontWeight: selectedDay === day ? 'bold' : 'normal',
                backgroundColor: selectedDay === day ? '#ddd' : '#fff'
                }}
            >
                Day {day}
            </button>
            ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        
       {/* 1. 세부 일정 목록 (D&D 라이브러리로 감싸기) */}
        <div style={{ width: '40%' }}>
          <h3>세부 일정 (Day {selectedDay})</h3> 
          
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={`day-${selectedDay}`}>
              {(provided) => (
                <ul
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  style={{ listStyle: 'none', padding: 0 }} // D&D를 위해 기본 ul 스타일 제거
                >
                  {itemsForSelectedDay.length > 0 ? (
                    itemsForSelectedDay.map((item, index) => (
                      <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                        {(provided) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps} // 이 부분이 손잡이 역할
                            style={{
                              ...provided.draggableProps.style, // D&D 스타일
                              borderBottom: '1px solid #eee',
                              padding: '10px',
                              marginBottom: '5px',
                              backgroundColor: '#fafafa' // 드래그 대상 시각화
                            }}
                          >
                            {/* (기존 li 내용물) */}
                            <div 
                              onClick={() => item.latitude && setMapCenter({ lat: item.latitude, lng: item.longitude })}
                              style={{ cursor: 'pointer' }}
                            >
                              <strong>{item.place_name}</strong>
                              <p style={{ fontSize: '0.9em', margin: '2px 0 0 0' }}>{item.memo || item.address}</p>
                            </div>
                            <div style={{ marginTop: '4px' }}>
                              <button onClick={() => handleUpdateItemMemo(item)} /* ... */ >[메모 수정]</button>
                              <button onClick={() => handleDeleteItem(item.id)} /* ... */ >&times;</button>
                            </div>
                          </li>
                        )}
                      </Draggable>
                    ))
                  ) : (
                    <p>Day {selectedDay}에 등록된 일정이 없습니다.</p>
                  )}
                  {provided.placeholder} {/* 드래그 시 공간을 차지할 Placeholder */}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* 2. 지도 (수정) */}
        <div style={{ width: '60%' }}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={12}
          >
            {/* 선택된 날짜(Day)의 마커만 표시하도록 수정 */}
            {itemsForSelectedDay.map(item => (
              item.latitude && item.longitude && (
                <Marker
                  key={item.id}
                  position={{ lat: item.latitude, lng: item.longitude }}
                  title={item.place_name}
                />
              )
            ))}

            {/* --- (새로 추가) Polyline (동선 그리기) --- */}
            <Polyline
              path={polylinePath}
              options={polylineOptions}
            />
          </GoogleMap>
        </div>
      </div>
    </div>
  )
}