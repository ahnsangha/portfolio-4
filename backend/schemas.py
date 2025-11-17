from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
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

    # (추가) day는 1 이상이어야 함
    @field_validator('day')
    @classmethod
    def check_day_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError('여행 일차(Day)는 1일 이상이어야 합니다.')
        return v

# 세부 일정 생성 시 (trip_id는 API 경로에서 받음)
class ItineraryItemCreate(ItineraryItemBase):
    pass

# --- 세부 일정 수정용 스키마 ---
class ItineraryItemUpdate(BaseModel):
    day: Optional[int] = None
    order_sequence: Optional[int] = None
    memo: Optional[str] = None

    # (추가) 수정 시에도 day가 있다면 1 이상이어야 함
    @field_validator('day')
    @classmethod
    def check_day_positive(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError('여행 일차(Day)는 1일 이상이어야 합니다.')
        return v

# DB에서 읽어올 때 (응답용) 스키마
class ItineraryItem(ItineraryItemBase):
    id: int
    trip_id: int

    class Config:
        orm_mode = True

# Trip 생성/수정 시 사용할 기본 스키마
class TripBase(BaseModel):
    title: str
    start_date: date | None = None 
    end_date: date | None = None

    # (추가) 종료일이 시작일보다 앞서지 않도록 검사
    @model_validator(mode='after')
    def check_dates(self) -> 'TripBase':
        # Pydantic v2에서는 self가 모델 인스턴스 자체일 수 있습니다.
        start = self.start_date
        end = self.end_date
        if start and end and end < start:
            raise ValueError('여행 종료일은 시작일보다 빠를 수 없습니다.')
        return self

# Trip 생성 시 받을 데이터 (TripBase 상속)
class TripCreate(TripBase):
    pass

# --- 여행 수정용 스키마 ---
class TripUpdate(BaseModel):
    title: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    # (추가) 수정 시에도 두 날짜가 모두 전달된 경우 검사
    @model_validator(mode='after')
    def check_dates(self) -> 'TripUpdate':
        start = self.start_date
        end = self.end_date
        # 사용자가 두 날짜를 모두 보냈는데 앞뒤가 안 맞을 경우 차단
        if start is not None and end is not None:
            if end < start:
                raise ValueError('여행 종료일은 시작일보다 빠를 수 없습니다.')
        return self

# DB에서 읽어올 때 (응답용) 스키마 (TripBase 상속)
class Trip(TripBase):
    id: int
    owner_id: int 
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

class User(BaseModel):
    id: int
    email: EmailStr
    username: str
    trips: list[Trip] = []

    class Config:
        orm_mode = True

# --- 세부 일정 순서 일괄 업데이트용 스키마 ---
class ItemOrderUpdate(BaseModel):
    id: int 
    order_sequence: int