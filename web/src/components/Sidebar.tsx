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

export function Sidebar({ tab, onTab, onOpenSettings }: SidebarProps) {
  return (
    <aside className="sidebar">
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
    </aside>
  )
}
