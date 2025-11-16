from pydantic import BaseModel, EmailStr, Field
from datetime import date

# --- Token  ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

# Trip 생성/수정 시 사용할 기본 스키마
class TripBase(BaseModel):
    title: str
    start_date: date | None = None # 날짜 타입
    end_date: date | None = None

# Trip 생성 시 받을 데이터 (TripBase 상속)
class TripCreate(TripBase):
    pass

# DB에서 읽어올 때 (응답용) 스키마 (TripBase 상속)
class Trip(TripBase):
    id: int
    owner_id: int # 이 여행의 소유자 id

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