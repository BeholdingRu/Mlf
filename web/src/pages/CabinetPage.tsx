import { useState, useEffect } from 'react'
import { DailyTasks } from '../components/DailyTasks'
import { SettingsModal } from '../components/SettingsModal'
import { Sidebar } from '../components/Sidebar'
import { StatsView } from '../components/StatsView'
import { CaloriesView } from '../components/CaloriesView'
import { TrainingView } from '../components/TrainingView'
import { DiaryView } from '../components/DiaryView'
import { MediaView } from '../components/MediaView'
import { PathView } from '../components/PathView'
import { useData } from '../hooks/useData'
import { useViewport } from '../hooks/useViewport'
import type { CabinetTab } from '../lib/types'
import { applyFontScale, applyTheme, normalizeFontScale, normalizeShabbatTheme, normalizeTheme } from '../lib/theme'
import { isShabbatActive } from '../lib/shabbat'
import { localISODate } from '../lib/dates'
import { isNutritionTask } from '../lib/nutrition-task'
import { getNextBibleLocation, type BibleNavigationTarget } from '../lib/bible-books'
import { ADMIN_TEST_TIME_CHANGE_EVENT, getAdminTestTime } from '../lib/admin-test-time'

const CABINET_TAB_STORAGE_KEY = 'mlf:cabinet-tab'
const CABINET_TABS: CabinetTab[] = ['daily', 'calories', 'training', 'media', 'path', 'all', 'diary']

function getSavedCabinetTab(): CabinetTab {
  if (window.matchMedia('(max-width: 768px)').matches) return 'calories'

  const savedTab = window.sessionStorage.getItem(CABINET_TAB_STORAGE_KEY)
  return CABINET_TABS.includes(savedTab as CabinetTab) ? savedTab as CabinetTab : 'daily'
}

export function CabinetPage() {
  const { adminMode, loading, error, profile, tasks, completions, scheduledExercises } = useData()
  const viewport = useViewport()
  const [tab, setTab] = useState<CabinetTab>(getSavedCabinetTab)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bibleNavigationRequest, setBibleNavigationRequest] = useState<BibleNavigationTarget | null>(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const hasPlannedTraining = scheduledExercises.some(
    (exercise) => !exercise.completed && exercise.planned_on === localISODate(currentTime),
  )
  const today = localISODate(currentTime)
  const hasIncompleteDailyTasks = tasks.some((task) => {
    const automaticTask = task.withdrawal_syndrome || (profile?.weight_enabled && isNutritionTask(task))
    const habitFormed = completions.filter((completion) => completion.task_id === task.id).length >= task.habit_days
    const completedToday = completions.some(
      (completion) => completion.task_id === task.id && completion.completed_on === today,
    )

    return !automaticTask && !habitFormed && !completedToday
  })

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
    const updateTime = () => setCurrentTime(adminMode ? getAdminTestTime(profile?.time_zone) ?? new Date() : new Date())
    updateTime()
    const timer = window.setInterval(updateTime, 5_000)
    window.addEventListener(ADMIN_TEST_TIME_CHANGE_EVENT, updateTime)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(ADMIN_TEST_TIME_CHANGE_EVENT, updateTime)
    }
  }, [adminMode, profile?.time_zone])

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
              : tab === 'media'
                ? 'Медиа'
                : 'Путь'

  function continueBibleReading() {
    const nextLocation = getNextBibleLocation(
      profile?.last_bible_book_order,
      profile?.last_bible_chapter,
    )
    setBibleNavigationRequest((current) => ({
      ...nextLocation,
      requestId: (current?.requestId ?? 0) + 1,
    }))
    setTab('path')
  }

  return (
    <div className="cabinet">
      <Sidebar
        tab={tab}
        onTab={setTab}
        onOpenSettings={() => setSettingsOpen(true)}
        hasPlannedTraining={hasPlannedTraining}
        hasIncompleteDailyTasks={hasIncompleteDailyTasks}
      />
      <main className="main">
        <header className={tab === 'calories' ? 'topbar calories-topbar' : 'topbar'}>
          {tab === 'path' ? (
            <div className="path-heading">
              <p className="path-heading-quote">
                Вникай в себя и в учение; занимайся сим постоянно: ибо, так поступая, и себя спасёшь, и слушающих тебя. 1Тим.4:16
              </p>
            </div>
          ) : (
            <h1>{heading}</h1>
          )}
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
            <DailyTasks onContinueBibleReading={continueBibleReading} />
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
        {!loading && (
          <MediaView compact={tab !== 'media'} />
        )}
        {!loading && (
          <div hidden={tab !== 'path'}>
            <PathView
              key={bibleNavigationRequest?.requestId ?? 'path'}
              bibleNavigationRequest={bibleNavigationRequest}
            />
          </div>
        )}
      </main>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
