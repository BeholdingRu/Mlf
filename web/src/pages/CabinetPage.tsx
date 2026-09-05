import { useState, useEffect } from 'react'
import { DailyTasks } from '../components/DailyTasks'
import { SettingsModal } from '../components/SettingsModal'
import { Sidebar } from '../components/Sidebar'
import { StatsView } from '../components/StatsView'
import { CaloriesView } from '../components/CaloriesView'
import { TrainingView } from '../components/TrainingView'
import { DiaryView } from '../components/DiaryView'
import { PathView } from '../components/PathView'
import { useData } from '../hooks/useData'
import { useViewport } from '../hooks/useViewport'
import type { CabinetTab } from '../lib/types'
import { applyFontScale, applyTheme, normalizeFontScale, normalizeShabbatTheme, normalizeTheme } from '../lib/theme'
import { isShabbatActive } from '../lib/shabbat'

const CABINET_TAB_STORAGE_KEY = 'mlf:cabinet-tab'
const CABINET_TABS: CabinetTab[] = ['daily', 'all', 'calories', 'training', 'diary', 'path']

function getSavedCabinetTab(): CabinetTab {
  const savedTab = window.sessionStorage.getItem(CABINET_TAB_STORAGE_KEY)
  return CABINET_TABS.includes(savedTab as CabinetTab) ? savedTab as CabinetTab : 'daily'
}

export function CabinetPage() {
  const { loading, error, profile } = useData()
  const viewport = useViewport()
  const [tab, setTab] = useState<CabinetTab>(getSavedCabinetTab)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())

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
    if (!profile) return
    applyTheme(isShabbatActive(profile, currentTime) ? normalizeShabbatTheme(profile.shabbat_theme) : normalizeTheme(profile.theme))
    applyFontScale(normalizeFontScale(profile.font_scale))
  }, [profile, currentTime])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!profile?.shabbat_enabled && tab === 'path') setTab('daily')
  }, [profile?.shabbat_enabled, tab])

  useEffect(() => {
    window.sessionStorage.setItem(CABINET_TAB_STORAGE_KEY, tab)
  }, [tab])

  const heading =
    tab === 'daily'
      ? 'Ежедневные задачи'
      : tab === 'all'
        ? 'Статистика'
        : tab === 'calories'
          ? 'Учет калорий'
          : tab === 'training'
            ? 'Тренировки'
            : tab === 'diary'
              ? 'Дневник'
              : 'Путь'

  return (
    <div className="cabinet">
      <Sidebar
        tab={tab}
        onTab={setTab}
        onOpenSettings={() => setSettingsOpen(true)}
        shabbatEnabled={profile?.shabbat_enabled ?? false}
      />
      <main className="main">
        <header className="topbar">
          <h1>{heading}</h1>
          <button
            type="button"
            className="primary settings-button topbar-settings-button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Настройки"
            title="Настройки"
          >
            <span aria-hidden="true">⚙</span>
          </button>
        </header>
        {loading && <p className="muted">Загрузка кабинета…</p>}
        {error && <p className="banner error">{error}</p>}
        {!loading && (
          <div hidden={tab !== 'daily'}>
            <DailyTasks />
          </div>
        )}
        {!loading && (
          <div hidden={tab !== 'all'}>
            <StatsView />
          </div>
        )}
        {!loading && (
          <div hidden={tab !== 'calories'}>
            <CaloriesView />
          </div>
        )}
        {!loading && (
          <div hidden={tab !== 'training'}>
            <TrainingView />
          </div>
        )}
        {!loading && (
          <div hidden={tab !== 'diary'}>
            <DiaryView />
          </div>
        )}
        {!loading && profile?.shabbat_enabled && (
          <div hidden={tab !== 'path'}>
            <PathView />
          </div>
        )}
      </main>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
