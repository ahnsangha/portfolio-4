import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext' // 1. 임포트

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider> {/* 2. 앱 전체를 감싸기 */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)