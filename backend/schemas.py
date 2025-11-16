from pydantic import BaseModel, EmailStr, Field
from datetime import date
from typing import List, Optional

# --- Token  ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

# 세부 일정의 기본 스키마
class ItineraryItemBase(BaseModel):
    day: int
    order_sequence: int
    place_name: str
    address: str | None = None
    memo: str | None = None
    latitude: float | None = None
    longitude: float | None = None

# 세부 일정 생성 시 (trip_id는 API 경로에서 받음)
class ItineraryItemCreate(ItineraryItemBase):
    pass

# --- 세부 일정 수정용 스키마 ---
# 사용자가 수정할 수 있는 필드만 (모두 선택적)
class ItineraryItemUpdate(BaseModel):
    day: Optional[int] = None
    order_sequence: Optional[int] = None
    memo: Optional[str] = None

# DB에서 읽어올 때 (응답용) 스키마
class ItineraryItem(ItineraryItemBase):
    id: int
    trip_id: int

    class Config:
        orm_mode = True

# Trip 생성/수정 시 사용할 기본 스키마
class TripBase(BaseModel):
    title: str
    start_date: date | None = None # 날짜 타입
    end_date: date | None = None

# Trip 생성 시 받을 데이터 (TripBase 상속)
class TripCreate(TripBase):
    pass

# --- 여행 수정용 스키마 ---
# TripBase와 유사하지만, 모든 필드를 선택적으로 받습니다.
class TripUpdate(BaseModel):
    title: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

# DB에서 읽어올 때 (응답용) 스키마 (TripBase 상속)
class Trip(TripBase):
    id: int
    owner_id: int # 이 여행의 소유자 id
    items: List[ItineraryItem] = []

    class Config:
        orm_mode = True

# --- User ---

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str = Field(..., min_length=8, max_length=72)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# User 정보를 응답할 때, 이 유저가 작성한 'trips' 목록도 포함시킵니다.
class User(BaseModel):
    id: int
    email: EmailStr
    username: str
    trips: list[Trip] = []

    class Config:
        orm_mode = True

# --- 세부 일정 순서 일괄 업데이트용 스키마 ---
class ItemOrderUpdate(BaseModel):
    id: int # 아이템의 ID
    order_sequence: int # 새로 부여될 순서