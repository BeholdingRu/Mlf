import { useEffect, useState } from 'react'
import { WeightWidget } from './WeightWidget'
import type { CabinetTab } from '../lib/types'

type SidebarProps = {
  tab: CabinetTab
  onTab: (tab: CabinetTab) => void
  onOpenSettings: () => void
  shabbatEnabled: boolean
  hasPlannedTraining: boolean
  hasIncompleteDailyTasks: boolean
}

const NAV: { id: CabinetTab; label: string }[] = [
  { id: 'daily', label: 'Ежедневные задачи' },
  { id: 'all', label: 'Статистика' },
  { id: 'calories', label: 'Учет калорий' },
  { id: 'training', label: 'Тренировки' },
  { id: 'diary', label: 'Дневник' },
  { id: 'media', label: 'Медиа' },
]

const MOBILE_SIDEBAR_OPEN_STORAGE_KEY = 'mlf:mobile-sidebar-open'

export function Sidebar({
  tab,
  onTab,
  onOpenSettings,
  shabbatEnabled,
  hasPlannedTraining,
  hasIncompleteDailyTasks,
}: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(
    () => window.sessionStorage.getItem(MOBILE_SIDEBAR_OPEN_STORAGE_KEY) === 'true',
  )
  const navigation = shabbatEnabled
    ? [...NAV.slice(0, -1), { id: 'path' as const, label: 'Путь' }, NAV[NAV.length - 1]]
    : NAV
  const currentTab = navigation.find((item) => item.id === tab) ?? NAV[0]
  const needsAttention = (item: CabinetTab) => (
    (item === 'daily' && hasIncompleteDailyTasks)
    || (item === 'training' && hasPlannedTraining)
  )

  useEffect(() => {
    window.sessionStorage.setItem(MOBILE_SIDEBAR_OPEN_STORAGE_KEY, String(mobileMenuOpen))
  }, [mobileMenuOpen])

  return (
    <aside className={`sidebar${mobileMenuOpen ? ' mobile-menu-open' : ''}`}>
      <button
        type="button"
        className="mobile-sidebar-toggle"
        onClick={() => setMobileMenuOpen((open) => !open)}
        aria-expanded={mobileMenuOpen}
        aria-controls="sidebar-navigation"
      >
        <span aria-hidden="true">☰</span>
        <span className={needsAttention(currentTab.id) ? 'nav-label-alert' : undefined}>
          {currentTab.label}
        </span>
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
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => onTab(item.id)}
            >
              <span className={needsAttention(item.id) ? 'nav-label-alert' : undefined}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}
