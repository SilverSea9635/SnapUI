import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.tsx'
import { initializeWebMcp } from './webmcp'

void initializeWebMcp().catch((error) => console.error('WebMCP 工具注册失败', error))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
