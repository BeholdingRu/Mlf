import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './style-1.css'
import './style-2.css'
import './shabbat-sky.css'
import App from './App.tsx'
import { initMobileOptimizations } from './lib/mobile'
import { applySavedFontScale, applySavedInterfaceStyle, applySavedTheme } from './lib/theme'

// Инициализируем мобильные оптимизации
initMobileOptimizations()
applySavedTheme()
applySavedInterfaceStyle()
applySavedFontScale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
