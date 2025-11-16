import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import Modal from 'react-modal';

// 모달이 #root 엘리먼트를 앱의 루트로 인식하도록 설정
Modal.setAppElement('#root');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider> {/* 앱 전체를 감싸기 */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)