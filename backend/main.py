from fastapi import FastAPI, Depends, HTTPException, status
# OAuth2, JWT를 위한 임포트 추가
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt # JWT 라이브러리 임포트
from datetime import datetime, timedelta, timezone # 시간 처리를 위해 3개 임포트
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os # .env 파일 읽기용

# 내부 모듈 임포트
import models, schemas
from database import engine, get_db

# --- 설정 ---

# (테이블 생성은 그대로 둠)
models.Base.metadata.create_all(bind=engine)

# (FastAPI 앱 인스턴스는 그대로 둠)
app = FastAPI()

# React 앱이 실행되는 주소 (Vite 기본값: 5173)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # origins 리스트에 있는 주소에서의 요청을 허용
    allow_credentials=True,    # 쿠키를 포함한 요청을 허용
    allow_methods=["*"],         # 모든 HTTP 메소드(GET, POST 등)를 허용
    allow_headers=["*"],         # 모든 HTTP 헤더를 허용
)

# --- .env에서 JWT 설정값 불러오기 ---
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

# (비밀번호 해싱 설정은 그대로 둠)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# (OAuth2 스키마 설정 - /api/auth/login 엔드포인트를 사용)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# --- 유틸리티 함수 ---

# (get_password_hash는 그대로 둠)
def get_password_hash(password: str):
    return pwd_context.hash(password)

# (get_user_by_email은 그대로 둠)
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

# --- 새 유틸리티 함수 (비밀번호 검증, 토큰 생성) ---

def verify_password(plain_password, hashed_password):
    """입력된 비밀번호와 해시된 비밀번호를 비교합니다."""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Access Token을 생성합니다."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15) # 기본 15분
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- API 엔드포인트 ---

# (루트 엔드포인트는 그대로 둠)
@app.get("/")
def read_root():
    return {"Hello": "Backend"}

# (회원가입 엔드포인트는 그대로 둠)
@app.post("/api/auth/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 이메일입니다."
        )
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user) 
    return db_user

# --- 로그인 엔드포인트 ---
@app.post("/api/auth/login", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    # 1. 이메일(username 필드 사용)로 사용자 확인
    user = get_user_by_email(db, email=form_data.username)
    
    # 2. 사용자가 없거나 비밀번호가 틀린 경우
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 잘못되었습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. 토큰 생성
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    """
    토큰을 디코딩하고, 해당 이메일의 사용자를 DB에서 찾아 반환합니다.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="유효한 자격 증명을 찾을 수 없습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # 토큰 디코딩
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub") # "sub" (subject)는 우리가 토큰 생성 시 넣은 이메일입니다.
        if email is None:
            raise credentials_exception
        
        # 토큰 데이터 스키마로 유효성 검사 (선택적이지만 좋음)
        token_data = schemas.TokenData(email=email)
        
    except JWTError:
        raise credentials_exception
    
    # DB에서 사용자 조회
    user = get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
        
    return user # user 객체를 반환합니다.


# --- "내 정보" 엔드포인트  ---
@app.get("/api/users/me", response_model=schemas.User)
async def read_users_me(
    current_user: models.User = Depends(get_current_user)
):
    """
    현재 로그인된 사용자의 정보를 반환합니다.
    Depends(get_current_user)가 토큰을 검사하고 사용자 정보를 주입해줍니다.
    """
    return current_user

@app.post("/api/trips", response_model=schemas.Trip, status_code=status.HTTP_201_CREATED)
def create_trip(
    trip: schemas.TripCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user) # (중요) 로그인한 사용자만
):
    """
    새로운 여행(Trip)을 생성합니다.
    """
    # trip 객체와 owner_id를 함께 DB 모델로 만듭니다.
    db_trip = models.Trip(**trip.model_dump(), owner_id=current_user.id)
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    return db_trip


@app.get("/api/trips", response_model=List[schemas.Trip])
def read_my_trips(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # (중요) 로그인한 사용자만
):
    """
    현재 로그인한 사용자의 모든 여행(Trip) 목록을 조회합니다.
    """
    # current_user.trips는 models.py의 "relationship" 덕분에 사용 가능합니다.
    return current_user.trips

# --- 특정 여행의 상세 정보 (세부 일정 포함) ---
@app.get("/api/trips/{trip_id}", response_model=schemas.Trip)
def read_trip_details(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    특정 여행(Trip)의 상세 정보와 모든 세부 일정(items)을 조회합니다.
    """
    db_trip = db.query(models.Trip).filter(
        models.Trip.id == trip_id,
        models.Trip.owner_id == current_user.id # (보안) 본인 여행만 조회
    ).first()
    
    if db_trip is None:
        raise HTTPException(status_code=404, detail="여행을 찾을 수 없습니다.")
        
    return db_trip

# --- 여행(Trip) 수정 ---
@app.put("/api/trips/{trip_id}", response_model=schemas.Trip)
def update_trip(
    trip_id: int,
    trip_update: schemas.TripUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    특정 여행(Trip)의 정보를 (제목, 날짜) 수정합니다.
    """
    db_trip = db.query(models.Trip).filter(
        models.Trip.id == trip_id,
        models.Trip.owner_id == current_user.id 
    ).first()
    
    if db_trip is None:
        raise HTTPException(status_code=404, detail="여행을 찾을 수 없습니다.")

    # Pydantic 모델에서 받은 데이터를 딕셔너리로 변환
    update_data = trip_update.model_dump(exclude_unset=True)
    
    # (추가) DB 업데이트 전 미리 적용해보고 날짜 유효성 검사
    # 주의: 실제 커밋 전에 메모리 상에서만 체크
    temp_start = update_data.get("start_date", db_trip.start_date)
    temp_end = update_data.get("end_date", db_trip.end_date)

    if temp_start and temp_end and temp_end < temp_start:
        raise HTTPException(
            status_code=400, 
            detail="여행 종료일은 시작일보다 빠를 수 없습니다."
        )

    for key, value in update_data.items():
        setattr(db_trip, key, value) 
        
    db.commit()
    db.refresh(db_trip)
    return db_trip

@app.delete("/api/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    특정 여행(Trip)을 삭제합니다.
    (models.py의 cascade 설정으로 인해 관련 items도 자동 삭제됩니다.)
    """
    db_trip = db.query(models.Trip).filter(
        models.Trip.id == trip_id,
        models.Trip.owner_id == current_user.id # 본인 여행만 삭제 가능
    ).first()
    
    if db_trip is None:
        raise HTTPException(status_code=404, detail="여행을 찾을 수 없습니다.")
        
    db.delete(db_trip)
    db.commit()
    return # 204 No Content는 응답 본문이 없어야 합니다.

# === ItineraryItem API 엔드포인트 ===

@app.post("/api/trips/{trip_id}/items", response_model=schemas.ItineraryItem, status_code=status.HTTP_201_CREATED)
def create_itinerary_item_for_trip(
    trip_id: int,
    item: schemas.ItineraryItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    특정 여행(Trip)에 새로운 세부 일정(ItineraryItem)을 추가합니다.
    """
    # 1. 이 여행이 현재 로그인한 사용자의 소유인지 확인
    db_trip = db.query(models.Trip).filter(
        models.Trip.id == trip_id,
        models.Trip.owner_id == current_user.id
    ).first()
    
    if db_trip is None:
        raise HTTPException(status_code=404, detail="여행을 찾을 수 없습니다.")
    
    # 2. 세부 일정(Item) 객체 생성 및 DB에 추가
    db_item = models.ItineraryItem(**item.model_dump(), trip_id=trip_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# --- 세부 일정(Item) 수정 ---
@app.put("/api/items/{item_id}", response_model=schemas.ItineraryItem)
def update_itinerary_item(
    item_id: int,
    item_update: schemas.ItineraryItemUpdate, # 방금 만든 스키마 사용
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    특정 세부 일정(ItineraryItem)을 (메모, 날짜, 순서) 수정합니다.
    """
    db_item = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.id == item_id
    ).first()

    if db_item is None:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")

    # (보안) 이 아이템이 속한 여행이 현재 사용자 소유인지 확인
    if db_item.trip.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")

    # Pydantic 모델에서 받은 데이터를 딕셔너리로 변환 (보낸 필드만)
    update_data = item_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

# --- 세부 일정(Item) 삭제 ---
@app.delete("/api/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_itinerary_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    특정 세부 일정(ItineraryItem)을 삭제합니다.
    """
    # 1. 삭제할 아이템을 찾습니다.
    db_item = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.id == item_id
    ).first()

    if db_item is None:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")

    # 2. (보안) 그 아이템이 속한 여행(Trip)이 현재 로그인한 사용자의 소유인지 확인
    # db_item.trip 관계(relationship)를 통해 소유자(owner)에 접근합니다.
    if db_item.trip.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
        
    # 3. 아이템 삭제
    db.delete(db_item)
    db.commit()
    return # 204 No Content

# --- 세부 일정(Item) 순서 일괄 업데이트 ---
@app.post("/api/items/reorder", response_model=List[schemas.ItineraryItem])
def reorder_itinerary_items(
    updates: List[schemas.ItemOrderUpdate], # 방금 만든 스키마의 '리스트'를 받음
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    세부 일정(ItineraryItem)의 순서(order_sequence)를 일괄 업데이트합니다.
    """
    # (매우 중요)
    # 이 로직은 간단한 구현이며,
    # 실제 프로덕션에서는 더 효율적인 bulk update 쿼리를 사용해야 합니다.
    
    updated_items = []
    
    # 1. DB에서 업데이트할 ID 목록을 먼저 조회합니다.
    item_ids = [update.id for update in updates]
    db_items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.id.in_(item_ids)
    ).all()
    
    # { id: db_item } 형태의 딕셔너리로 변환 (빠른 조회를 위해)
    item_map = {item.id: item for item in db_items}
    
    if len(db_items) != len(updates):
        raise HTTPException(status_code=404, detail="일부 일정을 찾을 수 없습니다.")

    # 2. 각 아이템의 소유권 검사 및 순서 업데이트
    for update in updates:
        db_item = item_map.get(update.id)
        
        # (보안) 이 아이템이 속한 여행이 현재 사용자 소유인지 확인
        if db_item.trip.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail=f"일정(ID: {db_item.id}) 수정 권한이 없습니다.")
            
        # 순서 업데이트
        db_item.order_sequence = update.order_sequence
        updated_items.append(db_item)
        
    # 3. DB에 일괄 커밋
    db.commit()
    
    # (선택) refresh가 필요하면 루프를 다시 돌아야 함
    # for item in updated_items:
    #     db.refresh(item)
        
    return updated_items