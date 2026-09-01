/**
 * Мобильная адаптация: предотвращение зума на input при фокусе и обработка safe areas
 */

export function initMobileOptimizations() {
  // Предотвращение зума на iOS при фокусе на input
  const inputs = document.querySelectorAll(
    'input[type="email"], input[type="password"], input[type="text"], input[type="number"]'
  )

  inputs.forEach((input) => {
    input.addEventListener('focus', () => {
      // Устанавливаем font-size >= 16px для предотвращения зума
      const style = window.getComputedStyle(input)
      const fontSize = parseFloat(style.fontSize)
      if (fontSize < 16) {
        ;(input as HTMLInputElement).style.fontSize = '16px'
      }
    })

    input.addEventListener('blur', () => {
      // Восстанавливаем оригинальный размер
      ;(input as HTMLInputElement).style.fontSize = ''
    })
  })

  // Обработка изменения размера при загрузке страницы
  const handleLoad = () => {
    const vh = window.innerHeight * 0.01
    document.documentElement.style.setProperty('--vh', `${vh}px`)
  }

  window.addEventListener('load', handleLoad)
  window.addEventListener('resize', handleLoad)
  handleLoad()

  // Предотвращение двойного клика на zoom на iOS
  let lastTouchEnd = 0
  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) {
        event.preventDefault()
      }
      lastTouchEnd = now
    },
    false
  )

  // Запретим горизонтальный скролл на мобильке
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    },
    { passive: false }
  )
}
