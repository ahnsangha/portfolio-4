from sqlalchemy import Column, Integer, String, Date, ForeignKey, Float
from sqlalchemy.orm import relationship 
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    trips = relationship("Trip", back_populates="owner", cascade="all, delete-orphan")

class Trip(Base):
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="trips")

    # Trip이 삭제되면 관련 Item들도 모두 삭제되도록 (cascade) 설정
    items = relationship("ItineraryItem", back_populates="trip", cascade="all, delete-orphan")

class ItineraryItem(Base):
    __tablename__ = "itinerary_items"

    id = Column(Integer, primary_key=True, index=True)
    day = Column(Integer, index=True, nullable=False) # 여행 N일차 (예: 1, 2, 3)
    order_sequence = Column(Integer, nullable=False)  # 같은 날짜 내의 순서
    
    place_name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    memo = Column(String, nullable=True)
    
    # --- 지도 API 연동을 위한 핵심 데이터 ---
    latitude = Column(Float, nullable=True)  # 위도 (예: 33.450701)
    longitude = Column(Float, nullable=True) # 경도 (예: 126.570667)
    
    # --- 외래 키 설정 ---
    # "trips" 테이블의 "id" 컬럼을 참조합니다.
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)

    # --- 관계 설정 ---
    # 이 Item이 "trip" (Trip 모델)과 관계가 있음을 알려줍니다.
    trip = relationship("Trip", back_populates="items")