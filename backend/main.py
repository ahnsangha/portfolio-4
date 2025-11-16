from fastapi import FastAPI

# FastAPI 앱 인스턴스 생성
app = FastAPI()

# 루트 엔드포인트 ("/")
@app.get("/")
def read_root():
    return {"Hello": "Backend"}
