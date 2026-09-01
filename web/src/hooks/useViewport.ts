import { useEffect, useState } from 'react'

interface ViewportSize {
  width: number
  height: number
  isMobile: boolean
  isTablet: boolean
  isLandscape: boolean
}

export function useViewport(): ViewportSize {
  const [viewport, setViewport] = useState<ViewportSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth < 1024 : false,
    isLandscape: typeof window !== 'undefined' ? window.innerHeight < window.innerWidth : false,
  }))

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
        isLandscape: window.innerHeight < window.innerWidth,
      })
    }

    const handleOrientationChange = () => {
      // Небольшая задержка для получения корректных размеров после ротации
      setTimeout(() => {
        handleResize()
        // Заставляем браузер пересчитать layout
        window.scrollTo(0, window.scrollY)
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)

    // Также слушаем изменение meta viewport для Safari
    const viewportMeta = document.querySelector('meta[name="viewport"]')
    if (viewportMeta) {
      viewportMeta.addEventListener('change', handleOrientationChange)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
      if (viewportMeta) {
        viewportMeta.removeEventListener('change', handleOrientationChange)
      }
    }
  }, [])

  return viewport
}
