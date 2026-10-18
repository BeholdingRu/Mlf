import { useEffect, useRef, useState } from 'react'
import { WeightWidget } from './WeightWidget'
import type { CabinetTab } from '../lib/types'

type SidebarProps = {
  tab: CabinetTab
  onTab: (tab: CabinetTab) => void
  onOpenSettings: () => void
  trainingStatus: 'planned' | 'completed' | null
  hasIncompleteDailyTasks: boolean
}

const NAV: { id: CabinetTab; label: string }[] = [
  { id: 'daily', label: 'Ежедневные задачи' },
  { id: 'calories', label: 'Учет калорий' },
  { id: 'training', label: 'Тренировки' },
  { id: 'path', label: 'Путь' },
  { id: 'all', label: 'Статистика' },
  { id: 'diary', label: 'Дневник' },
]

const MOBILE_SIDEBAR_OPEN_STORAGE_KEY = 'mlf:mobile-sidebar-open'

export function Sidebar({
  tab,
  onTab,
  onOpenSettings,
  trainingStatus,
  hasIncompleteDailyTasks,
}: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(
    () => window.sessionStorage.getItem(MOBILE_SIDEBAR_OPEN_STORAGE_KEY) === 'true',
  )
  const sidebarRef = useRef<HTMLElement>(null)
  const currentTab = NAV.find((item) => item.id === tab) ?? NAV[0]
  const needsAttention = (item: CabinetTab) => (
    (item === 'daily' && hasIncompleteDailyTasks)
    || (item === 'training' && trainingStatus === 'planned')
  )

  const renderNavLabel = (item: { id: CabinetTab; label: string }) => (
    <span className={`nav-label-content${needsAttention(item.id) ? ' nav-label-alert' : ''}`}>
      {item.label}
      {item.id === 'training' && trainingStatus && (
        <span
          className={trainingStatus === 'completed' ? 'nav-training-status completed' : 'nav-training-status'}
          role="img"
          aria-label={trainingStatus === 'completed'
            ? 'Все тренировки на сегодня выполнены'
            : 'На сегодня запланирована тренировка'}
        >
          {trainingStatus === 'completed' ? '✓' : ''}
        </span>
      )}
    </span>
  )

  useEffect(() => {
    window.sessionStorage.setItem(MOBILE_SIDEBAR_OPEN_STORAGE_KEY, String(mobileMenuOpen))
  }, [mobileMenuOpen])

  useEffect(() => {
    const sidebar = sidebarRef.current
    if (!sidebar) return

    const keepDesktopSidebarFixed = (event: WheelEvent) => {
      if (!window.matchMedia('(min-width: 1025px)').matches) return
      event.preventDefault()
      event.stopPropagation()
    }

    sidebar.addEventListener('wheel', keepDesktopSidebarFixed, { passive: false })
    return () => sidebar.removeEventListener('wheel', keepDesktopSidebarFixed)
  }, [])

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar${mobileMenuOpen ? ' mobile-menu-open' : ''}`}
    >
      <button
        type="button"
        className="mobile-sidebar-toggle"
        onClick={() => setMobileMenuOpen((open) => !open)}
        aria-expanded={mobileMenuOpen}
        aria-controls="sidebar-navigation"
      >
        <span aria-hidden="true">☰</span>
        {renderNavLabel(currentTab)}
        <span aria-hidden="true">{mobileMenuOpen ? '⌃' : '⌄'}</span>
      </button>
      <div id="sidebar-navigation" className="sidebar-content">
        <WeightWidget />
        <button
          type="button"
          className="primary settings-button sidebar-settings-button"
          onClick={onOpenSettings}
          aria-label="Настройки"
          title="Настройки"
        >
          <span aria-hidden="true">⚙</span>
        </button>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => onTab(item.id)}
            >
              {renderNavLabel(item)}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}
