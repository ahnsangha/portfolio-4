import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // 1. 임포트
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter> {/* 2. App을 BrowserRouter로 감싸기 */}
      <App />
    </BrowserRouter>
  </StrictMode>,
)