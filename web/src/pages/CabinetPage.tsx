import { lazy, Suspense, useState, useEffect } from 'react'
import { Sidebar } from '../components/Sidebar'
import { LazySectionBoundary } from '../components/LazySectionBoundary'
import { useData } from '../hooks/useData'
import { useViewport } from '../hooks/useViewport'
import type { CabinetTab } from '../lib/types'
import {
  applyFontScale,
  applyInterfaceStyle,
  applyTheme,
  normalizeFontScale,
  normalizeInterfaceStyle,
  normalizeShabbatTheme,
  normalizeTheme,
} from '../lib/theme'
import { isShabbatActive } from '../lib/shabbat'
import { isoDateInTimeZone } from '../lib/dates'
import { isNutritionTask } from '../lib/nutrition-task'
import { getCountdownTaskProgress, getRegularTaskProgressDays } from '../lib/task-progress'
import { getNextBibleLocation, isBibleReadingTask, type BibleNavigationTarget } from '../lib/bible-books'
import { ADMIN_TEST_TIME_CHANGE_EVENT, getAdminTestTime } from '../lib/admin-test-time'

const CABINET_TAB_STORAGE_KEY = 'mlf:cabinet-tab'
const CABINET_TABS: CabinetTab[] = ['daily', 'calories', 'training', 'path', 'all', 'diary']

const DailyTasks = lazy(() => import('../components/DailyTasks').then((module) => ({
  default: module.DailyTasks,
})))
const StatsView = lazy(() => import('../components/StatsView').then((module) => ({
  default: module.StatsView,
})))
const CaloriesView = lazy(() => import('../components/CaloriesView').then((module) => ({
  default: module.CaloriesView,
})))
const TrainingView = lazy(() => import('../components/TrainingView').then((module) => ({
  default: module.TrainingView,
})))
const DiaryView = lazy(() => import('../components/DiaryView').then((module) => ({
  default: module.DiaryView,
})))
const PathView = lazy(() => import('../components/PathView').then((module) => ({
  default: module.PathView,
})))
const SettingsModal = lazy(() => import('../components/SettingsModal').then((module) => ({
  default: module.SettingsModal,
})))

function getSavedCabinetTab(): CabinetTab {
  if (window.matchMedia('(max-width: 768px)').matches) return 'calories'

  const savedTab = window.sessionStorage.getItem(CABINET_TAB_STORAGE_KEY)
  return CABINET_TABS.includes(savedTab as CabinetTab) ? savedTab as CabinetTab : 'daily'
}

export function CabinetPage() {
  const { adminMode, loading, error, profile, tasks, completions, scheduledExercises } = useData()
  const viewport = useViewport()
  const [tab, setTab] = useState<CabinetTab>(getSavedCabinetTab)
  const [mountedTabs, setMountedTabs] = useState<Set<CabinetTab>>(() => new Set([tab]))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bibleNavigationRequest, setBibleNavigationRequest] = useState<BibleNavigationTarget | null>(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const today = isoDateInTimeZone(profile?.time_zone, currentTime)
  const todayExercises = scheduledExercises.filter((exercise) => exercise.planned_on === today)
  const trainingStatus = todayExercises.length === 0
    ? null
    : todayExercises.every((exercise) => exercise.completed) ? 'completed' : 'planned'
  const bibleToday = today
  const hasIncompleteDailyTasks = tasks.some((task) => {
    const taskToday = isBibleReadingTask(task) ? bibleToday : today
    const automaticTask = task.withdrawal_syndrome || task.inverted_logic || (profile?.weight_enabled && isNutritionTask(task))
    const habitFormed = task.countdown_enabled
      ? getCountdownTaskProgress(task, completions, taskToday, profile?.time_zone).finished
      : getRegularTaskProgressDays(task, completions, taskToday, profile?.time_zone) >= task.habit_days
    const completedToday = completions.some(
      (completion) => completion.task_id === task.id && completion.completed_on === taskToday,
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
    applyInterfaceStyle(normalizeInterfaceStyle(profile.interface_style))
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
    openTab('path')
  }

  function openTab(nextTab: CabinetTab) {
    setMountedTabs((current) => current.has(nextTab) ? current : new Set(current).add(nextTab))
    setTab(nextTab)
  }

  return (
    <div className="cabinet">
      <div className="shabbat-sky-layer" aria-hidden="true" />
      <Sidebar
        tab={tab}
        onTab={openTab}
        onOpenSettings={() => setSettingsOpen(true)}
        trainingStatus={trainingStatus}
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
        {!loading && mountedTabs.has('daily') && (
          <div hidden={tab !== 'daily'}>
            <LazySectionBoundary label="ежедневные задачи">
              <Suspense fallback={<p className="muted">Загрузка раздела…</p>}>
                <DailyTasks onContinueBibleReading={continueBibleReading} />
              </Suspense>
            </LazySectionBoundary>
          </div>
        )}
        {!loading && mountedTabs.has('all') && (
          <div hidden={tab !== 'all'}>
            <LazySectionBoundary label="статистику">
              <Suspense fallback={<p className="muted">Загрузка раздела…</p>}>
                <StatsView />
              </Suspense>
            </LazySectionBoundary>
          </div>
        )}
        {!loading && mountedTabs.has('calories') && (
          <div hidden={tab !== 'calories'}>
            <LazySectionBoundary label="учёт калорий">
              <Suspense fallback={<p className="muted">Загрузка раздела…</p>}>
                <CaloriesView />
              </Suspense>
            </LazySectionBoundary>
          </div>
        )}
        {!loading && mountedTabs.has('training') && (
          <div hidden={tab !== 'training'}>
            <LazySectionBoundary label="тренировки">
              <Suspense fallback={<p className="muted">Загрузка раздела…</p>}>
                <TrainingView />
              </Suspense>
            </LazySectionBoundary>
          </div>
        )}
        {!loading && mountedTabs.has('diary') && (
          <div hidden={tab !== 'diary'}>
            <LazySectionBoundary label="дневник">
              <Suspense fallback={<p className="muted">Загрузка раздела…</p>}>
                <DiaryView />
              </Suspense>
            </LazySectionBoundary>
          </div>
        )}
        {!loading && mountedTabs.has('path') && (
          <div hidden={tab !== 'path'}>
            <LazySectionBoundary label="путь">
              <Suspense fallback={<p className="muted">Загрузка раздела…</p>}>
                <PathView
                  key={bibleNavigationRequest?.requestId ?? 'path'}
                  bibleNavigationRequest={bibleNavigationRequest}
                />
              </Suspense>
            </LazySectionBoundary>
          </div>
        )}
      </main>
      {settingsOpen && (
        <LazySectionBoundary label="настройки">
          <Suspense fallback={<p className="banner">Загрузка настроек…</p>}>
            <SettingsModal onClose={() => setSettingsOpen(false)} />
          </Suspense>
        </LazySectionBoundary>
      )}
    </div>
  )
}
