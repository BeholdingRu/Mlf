import { useEffect, useState } from 'react'
import { WeightWidget } from './WeightWidget'
import type { CabinetTab } from '../lib/types'

type SidebarProps = {
  tab: CabinetTab
  onTab: (tab: CabinetTab) => void
  onOpenSettings: () => void
  shabbatEnabled: boolean
}

const NAV: { id: CabinetTab; label: string }[] = [
  { id: 'daily', label: 'Ежедневные задачи' },
  { id: 'all', label: 'Статистика' },
  { id: 'calories', label: 'Учет калорий' },
  { id: 'training', label: 'Тренировки' },
  { id: 'diary', label: 'Дневник' },
]

const MOBILE_SIDEBAR_OPEN_STORAGE_KEY = 'mlf:mobile-sidebar-open'
const DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY = 'mlf:desktop-sidebar-collapsed'

export function Sidebar({ tab, onTab, onOpenSettings, shabbatEnabled }: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(
    () => window.sessionStorage.getItem(MOBILE_SIDEBAR_OPEN_STORAGE_KEY) === 'true',
  )
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(
    () => window.sessionStorage.getItem(DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true',
  )
  const navigation = shabbatEnabled
    ? [...NAV.slice(0, -1), { id: 'path' as const, label: 'Путь' }, NAV[NAV.length - 1]]
    : NAV
  const currentTab = navigation.find((item) => item.id === tab) ?? NAV[0]

  useEffect(() => {
    window.sessionStorage.setItem(MOBILE_SIDEBAR_OPEN_STORAGE_KEY, String(mobileMenuOpen))
  }, [mobileMenuOpen])

  useEffect(() => {
    window.sessionStorage.setItem(DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY, String(desktopSidebarCollapsed))
  }, [desktopSidebarCollapsed])

  return (
    <aside className={`sidebar${mobileMenuOpen ? ' mobile-menu-open' : ''}${desktopSidebarCollapsed ? ' desktop-sidebar-collapsed' : ''}`}>
      <button
        type="button"
        className="mobile-sidebar-toggle"
        onClick={() => setMobileMenuOpen((open) => !open)}
        aria-expanded={mobileMenuOpen}
        aria-controls="sidebar-navigation"
      >
        <span aria-hidden="true">☰</span>
        <span>{currentTab.label}</span>
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
          <button
            type="button"
            className="desktop-sidebar-toggle"
            onClick={() => setDesktopSidebarCollapsed((collapsed) => !collapsed)}
            aria-expanded={!desktopSidebarCollapsed}
            aria-controls="sidebar-navigation"
            aria-label={desktopSidebarCollapsed ? 'Показать навигацию' : 'Скрыть навигацию'}
            title={desktopSidebarCollapsed ? 'Показать навигацию' : 'Скрыть навигацию'}
          >
            <span aria-hidden="true">{desktopSidebarCollapsed ? '›' : '‹'}</span>
          </button>
          {navigation.map((item) => (
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
