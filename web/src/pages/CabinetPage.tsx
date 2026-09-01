import { useState, useEffect } from 'react'
import { DailyTasks } from '../components/DailyTasks'
import { SettingsModal } from '../components/SettingsModal'
import { Sidebar } from '../components/Sidebar'
import { StatsView } from '../components/StatsView'
import { CaloriesView } from '../components/CaloriesView'
import { ProductsView } from '../components/ProductsView'
import { DiaryView } from '../components/DiaryView'
import { useData } from '../context/DataContext'
import { useViewport } from '../hooks/useViewport'
import type { CabinetTab } from '../lib/types'
import { applyTheme, normalizeTheme } from '../lib/theme'

export function CabinetPage() {
  const { loading, error, profile } = useData()
  const viewport = useViewport()
  const [tab, setTab] = useState<CabinetTab>('daily')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Принудительно пересчитываем layout при смене вкладок на мобилке
  useEffect(() => {
    if (viewport.isMobile) {
      // Небольшая задержка для обеспечения корректного рендера
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [tab, viewport.isMobile])

  useEffect(() => {
    if (profile) applyTheme(normalizeTheme(profile.theme))
  }, [profile])

  const heading =
    tab === 'daily'
      ? 'Ежедневные задачи'
      : tab === 'all'
        ? 'Статистика'
        : tab === 'calories'
          ? 'Учет калорий'
          : tab === 'products'
            ? 'Продукты'
            : 'Дневник'

  return (
    <div className="cabinet">
      <Sidebar tab={tab} onTab={setTab} />
      <main className="main">
        <header className="topbar">
          <h1>{heading}</h1>
          <button type="button" className="primary" onClick={() => setSettingsOpen(true)}>
            Настройки
          </button>
        </header>
        {loading && <p className="muted">Загрузка кабинета…</p>}
        {error && <p className="banner error">{error}</p>}
        {!loading && tab === 'daily' && <DailyTasks />}
        {!loading && tab === 'all' && <StatsView />}
        {!loading && tab === 'calories' && <CaloriesView />}
        {!loading && tab === 'products' && <ProductsView />}
        {!loading && tab === 'diary' && <DiaryView />}
      </main>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
