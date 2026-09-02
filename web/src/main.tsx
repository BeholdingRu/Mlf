import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initMobileOptimizations } from './lib/mobile'
import { applySavedFontScale, applySavedTheme } from './lib/theme'

// Инициализируем мобильные оптимизации
initMobileOptimizations()
applySavedTheme()
applySavedFontScale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
