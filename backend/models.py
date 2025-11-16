from sqlalchemy import Column, Integer, String, Date, ForeignKey
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
    start_date = Column(Date, nullable=True) # 여행 시작일 (선택)
    end_date = Column(Date, nullable=True)   # 여행 종료일 (선택)
    
    # --- 외래 키 설정 ---
    # "users" 테이블의 "id" 컬럼을 참조합니다.
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # --- 관계 설정 ---
    # 이 Trip이 "owner" (User 모델)와 관계가 있음을 알려줍니다.
    owner = relationship("User", back_populates="trips")