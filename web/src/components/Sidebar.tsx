import { useEffect, useState } from 'react'
import { WeightWidget } from './WeightWidget'
import type { CabinetTab } from '../lib/types'

type SidebarProps = {
  tab: CabinetTab
  onTab: (tab: CabinetTab) => void
  onOpenSettings: () => void
}

const NAV: { id: CabinetTab; label: string }[] = [
  { id: 'daily', label: 'Ежедневные задачи' },
  { id: 'all', label: 'Статистика' },
  { id: 'calories', label: 'Учет калорий' },
  { id: 'training', label: 'Тренировки' },
  { id: 'diary', label: 'Дневник' },
]

const MOBILE_SIDEBAR_OPEN_STORAGE_KEY = 'mlf:mobile-sidebar-open'

export function Sidebar({ tab, onTab, onOpenSettings }: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(
    () => window.sessionStorage.getItem(MOBILE_SIDEBAR_OPEN_STORAGE_KEY) === 'true',
  )
  const currentTab = NAV.find((item) => item.id === tab) ?? NAV[0]

  useEffect(() => {
    window.sessionStorage.setItem(MOBILE_SIDEBAR_OPEN_STORAGE_KEY, String(mobileMenuOpen))
  }, [mobileMenuOpen])

  return (
    <aside className={mobileMenuOpen ? 'sidebar mobile-menu-open' : 'sidebar'}>
      <button
        type="button"
        className="mobile-sidebar-toggle"
        onClick={() => setMobileMenuOpen((open) => !open)}
        aria-expanded={mobileMenuOpen}
        aria-controls="mobile-sidebar-content"
      >
        <span aria-hidden="true">☰</span>
        <span>{currentTab.label}</span>
        <span aria-hidden="true">{mobileMenuOpen ? '⌃' : '⌄'}</span>
      </button>
      <div id="mobile-sidebar-content" className="sidebar-content">
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
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}
