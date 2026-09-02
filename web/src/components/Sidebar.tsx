import { WeightWidget } from './WeightWidget'
import type { CabinetTab } from '../lib/types'

type SidebarProps = {
  tab: CabinetTab
  onTab: (tab: CabinetTab) => void
}

const NAV: { id: CabinetTab; label: string }[] = [
  { id: 'daily', label: 'Ежедневные задачи' },
  { id: 'all', label: 'Статистика' },
  { id: 'calories', label: 'Учет калорий' },
  { id: 'training', label: 'Тренеровки' },
  { id: 'diary', label: 'Дневник' },
]

export function Sidebar({ tab, onTab }: SidebarProps) {
  return (
    <aside className="sidebar">
      <WeightWidget />
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
