import { useState } from 'react'
import { useData } from '../hooks/useData'
import {
  BIBLE_READING_TASK_TITLE,
  composeBibleReadingTaskTitle,
  extractBibleReadingTaskSuffix,
} from '../lib/bible-books'
import { NUTRITION_TASK_TITLE } from '../lib/nutrition-task'
import type { Task } from '../lib/types'

type DefaultTaskSettingsProps = {
  nutritionTask?: Task
  bibleTask?: Task
}

const DEFAULT_HABIT_DAYS = 21
const DEFAULT_BIBLE_CHAPTER_TARGET = 5

export function DefaultTaskSettings({ nutritionTask, bibleTask }: DefaultTaskSettingsProps) {
  return (
    <div className="default-task-settings" aria-label="Стандартные задачи">
      <NutritionTaskSettings key={nutritionTask?.id ?? 'nutrition-template'} task={nutritionTask} />
      <BibleTaskSettings key={bibleTask?.id ?? 'bible-template'} task={bibleTask} />
    </div>
  )
}

function NutritionTaskSettings({ task }: { task?: Task }) {
  const { addTask, updateTask, deleteTask } = useData()
  const [days, setDays] = useState(String(task?.habit_days ?? DEFAULT_HABIT_DAYS))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveNutritionTask() {
    setError(null)
    setBusy(true)
    try {
      const habitDays = parsePositiveInteger(days, 'Количество дней шкалы')
      if (task) {
        await updateTask(task.id, {
          title: NUTRITION_TASK_TITLE,
          habit_days: habitDays,
          task_kind: 'nutrition',
          bible_daily_chapter_target: null,
          inverted_logic: false,
        })
      } else {
        await addTask(
          NUTRITION_TASK_TITLE,
          habitDays,
          false,
          false,
          { taskKind: 'nutrition', bibleDailyChapterTarget: null },
        )
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить задачу питания')
    } finally {
      setBusy(false)
    }
  }

  async function removeNutritionTask() {
    if (!task || !window.confirm(`Удалить задачу «${task.title}»?`)) return
    setError(null)
    setBusy(true)
    try {
      await deleteTask(task.id)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить задачу питания')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="default-task-card" aria-labelledby="default-nutrition-task-title">
      <h3 id="default-nutrition-task-title">{NUTRITION_TASK_TITLE}</h3>
      <label>
        Дней до заполнения шкалы
        <input
          type="number"
          min={1}
          step={1}
          className="days"
          value={days}
          disabled={busy}
          onChange={(event) => {
            setDays(event.target.value)
            setError(null)
          }}
        />
      </label>
      <div className="default-task-actions">
        {task ? (
          <>
            <button type="button" className="ghost compact" disabled={busy} onClick={() => void saveNutritionTask()}>
              Сохранить
            </button>
            <button type="button" className="danger compact" disabled={busy} onClick={() => void removeNutritionTask()}>
              Удалить
            </button>
          </>
        ) : (
          <button type="button" className="primary compact" disabled={busy} onClick={() => void saveNutritionTask()}>
            Добавить
          </button>
        )}
      </div>
      {error && <p className="banner error">{error}</p>}
    </section>
  )
}

function BibleTaskSettings({ task }: { task?: Task }) {
  const { addTask, updateTask, deleteTask } = useData()
  const [suffix, setSuffix] = useState(() => extractBibleReadingTaskSuffix(task?.title ?? ''))
  const [days, setDays] = useState(String(task?.habit_days ?? DEFAULT_HABIT_DAYS))
  const [chapterTarget, setChapterTarget] = useState(
    String(task?.bible_daily_chapter_target ?? DEFAULT_BIBLE_CHAPTER_TARGET),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveTask() {
    setError(null)
    setBusy(true)
    try {
      const habitDays = parsePositiveInteger(days, 'Количество дней шкалы')
      const dailyChapterTarget = parsePositiveInteger(chapterTarget, 'Количество глав')
      const title = composeBibleReadingTaskTitle(suffix)
      if (task) {
        await updateTask(task.id, {
          title,
          habit_days: habitDays,
          task_kind: 'bible_reading',
          bible_daily_chapter_target: dailyChapterTarget,
          inverted_logic: false,
        })
      } else {
        await addTask(
          title,
          habitDays,
          false,
          false,
          { taskKind: 'bible_reading', bibleDailyChapterTarget: dailyChapterTarget },
        )
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить задачу чтения Библии')
    } finally {
      setBusy(false)
    }
  }

  async function removeTask() {
    if (!task || !window.confirm(`Удалить задачу «${task.title}»?`)) return
    setError(null)
    setBusy(true)
    try {
      await deleteTask(task.id)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить задачу чтения Библии')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="default-task-card bible-default-task-card" aria-labelledby="default-bible-task-title">
        <h3 id="default-bible-task-title">{BIBLE_READING_TASK_TITLE}</h3>
        <label className="default-bible-task-title-field">
          Дополнение к названию
          <span className="default-bible-task-title-input">
            <span className="default-bible-task-title-prefix">{BIBLE_READING_TASK_TITLE}</span>
            <input
              value={suffix}
              disabled={busy}
              placeholder="Дополнение"
              aria-label="Дополнение к названию задачи «Чтение Библии»"
              onChange={(event) => {
                setSuffix(event.target.value)
                setError(null)
              }}
            />
          </span>
        </label>
        <label>
          Дней до заполнения шкалы
          <input
            type="number"
            min={1}
            step={1}
            className="days"
            value={days}
            disabled={busy}
            onChange={(event) => {
              setDays(event.target.value)
              setError(null)
            }}
          />
        </label>
        <label>
          Желаемое количество глав в сутки
          <input
            type="number"
            min={1}
            step={1}
            value={chapterTarget}
            disabled={busy}
            onChange={(event) => {
              setChapterTarget(event.target.value)
              setError(null)
            }}
          />
        </label>
        <p className="hint default-bible-task-hint">
          После 5 глав дальнейшее чтение за текущие сутки учитывается только в этом браузере.
        </p>
        <div className="default-task-actions">
          {task ? (
            <>
              <button type="button" className="ghost compact" disabled={busy} onClick={() => void saveTask()}>
                Сохранить
              </button>
              <button type="button" className="danger compact" disabled={busy} onClick={() => void removeTask()}>
                Удалить
              </button>
            </>
          ) : (
            <button type="button" className="primary compact" disabled={busy} onClick={() => void saveTask()}>
              Добавить
            </button>
          )}
        </div>
        {error && <p className="banner error">{error}</p>}
      </section>
  )
}

function parsePositiveInteger(value: string, fieldName: string) {
  const parsedValue = Number(value)
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${fieldName} должно быть целым числом от 1`)
  }
  return parsedValue
}
