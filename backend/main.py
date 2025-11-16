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