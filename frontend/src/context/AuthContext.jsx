import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

// 1. Axios 인스턴스를 여기서 딱 한 번 생성합니다.
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// 2. Context 생성
const AuthContext = createContext(null);

// 3. Provider 컴포넌트 생성 (모든 인증 로직을 담당)
export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('MY_APP_TOKEN') || null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true); // (추가) 처음 로딩 상태

  useEffect(() => {
    if (token) {
      // 1. 토큰이 있으면: api 헤더 설정, 로컬 스토리지 저장
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('MY_APP_TOKEN', token);
      
      // 2. "내 정보"를 불러와서 userData에 저장
      setLoading(true);
      api.get('/api/users/me')
        .then(response => {
          setUserData(response.data);
          setLoading(false);
        })
        .catch(err => {
          // 토큰이 유효하지 않으면 (예: 만료) 로그아웃 처리
          console.error("Auth useEffect 에러:", err);
          setToken(null); // 토큰 초기화 (이것이 로그아웃)
          setLoading(false);
        });
        
    } else {
      // 2. 토큰이 없으면: 헤더 삭제, 로컬 스토리지 삭제
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('MY_APP_TOKEN');
      setUserData(null);
      setLoading(false);
    }
  }, [token]); // token 상태가 변경될 때마다 이 로직이 실행됨

  // 4. 로그인 함수
  const login = async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    // (axios 직접 호출: 이 시점엔 토큰이 없음)
    const response = await axios.post(
      `${API_URL}/api/auth/login`, 
      formData,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    // 성공 시 토큰 상태를 업데이트 -> useEffect가 실행됨
    setToken(response.data.access_token);
  };

  // 5. 로그아웃 함수
  const logout = () => {
    setToken(null); // 토큰 상태를 null로 변경 -> useEffect가 실행됨
  };

  // 6. Context를 통해 공유할 값들
  const value = {
    token,
    userData,
    api, // (중요) 인증된 api 인스턴스
    login,
    logout,
    isLoading: loading // (추가) 로딩 상태
  };

  // 로딩 중일 때는 children을 렌더링하지 않음 (선택 사항)
  // if (loading) {
  //   return <p>인증 정보 로딩 중...</p>;
  // }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 7. 이 Context를 쉽게 사용하기 위한 Custom Hook
export const useAuth = () => {
  return useContext(AuthContext);
};