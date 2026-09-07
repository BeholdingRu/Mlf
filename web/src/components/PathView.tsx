import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { useData } from '../hooks/useData'
import { getShabbatWeekStart } from '../lib/shabbat'
import type { MindfulnessNote, PathDay } from '../lib/types'
import { BibleView } from './BibleView'

type PathSubTab = 'bible' | 'sh' | 'shalom-school' | 'mindfulness-practicum'

const PATH_SUB_TAB_STORAGE_KEY = 'mlf:path-sub-tab'
const MINDFULNESS_NOTE_DRAFT_STORAGE_KEY = 'mlf:mindfulness-note-draft'
const MINDFULNESS_NOTE_FULLSCREEN_STORAGE_KEY = 'mlf:mindfulness-note-fullscreen'
const MINDFULNESS_NOTE_TITLE_MAX_LENGTH = 160
const MINDFULNESS_NOTE_CONTENT_MAX_LENGTH = 7000
const SABBATH_SCHOOL_LESSONS_URL = 'https://esd.adventist.org/library/periodicals/sabbath-school/adult-sabbath-school/'

type MindfulnessNoteDraft = {
  title: string
  content: string
  editingNoteId: string | null
  categoryId: string | null
}

const SUB_TABS: { id: PathSubTab; label: string }[] = [
  { id: 'bible', label: 'Библия' },
  { id: 'sh', label: 'С.Ш.' },
  { id: 'shalom-school', label: 'Школа Шалом' },
  { id: 'mindfulness-practicum', label: 'Практикум осознанности' },
]

const PATH_DAYS: { id: PathDay; label: string }[] = [
  { id: 'saturday', label: 'Суббота' },
  { id: 'sunday', label: 'Воскресенье' },
  { id: 'monday', label: 'Понедельник' },
  { id: 'tuesday', label: 'Вторник' },
  { id: 'wednesday', label: 'Среда' },
  { id: 'thursday', label: 'Четверг' },
  { id: 'friday', label: 'Пятница' },
]

const SHALOM_COURSES = [
  { id: 'biblical-hebrew-first-steps', title: 'Библейский иврит — первые шаги', lessons: 13 },
  { id: 'how-to-study-the-bible', title: 'Как изучать Библию', lessons: 22 },
  { id: 'bible-in-jewish-tradition', title: 'Библия в свете еврейской традиции', lessons: 22 },
  { id: 'ancient-peoples-of-the-bible', title: 'Древние народы Библии', lessons: 15 },
  { id: 'torah-research-principles', title: 'Принципы исследования Торы', lessons: 40 },
] as const

function getSavedPathSubTab(): PathSubTab {
  const savedTab = window.sessionStorage.getItem(PATH_SUB_TAB_STORAGE_KEY)
  return SUB_TABS.some((tab) => tab.id === savedTab) ? savedTab as PathSubTab : 'bible'
}

function getSavedMindfulnessNoteFullscreenState() {
  return window.sessionStorage.getItem(MINDFULNESS_NOTE_FULLSCREEN_STORAGE_KEY) === 'true'
}

function getSavedMindfulnessNoteDraft(): MindfulnessNoteDraft | null {
  try {
    const savedDraft = window.sessionStorage.getItem(MINDFULNESS_NOTE_DRAFT_STORAGE_KEY)
    if (!savedDraft) return null

    const draft = JSON.parse(savedDraft) as Partial<MindfulnessNoteDraft>
    if (
      typeof draft.title !== 'string'
      || typeof draft.content !== 'string'
      || (draft.editingNoteId !== null && typeof draft.editingNoteId !== 'string')
      || (draft.categoryId !== null && typeof draft.categoryId !== 'string')
    ) {
      window.sessionStorage.removeItem(MINDFULNESS_NOTE_DRAFT_STORAGE_KEY)
      return null
    }

    return {
      title: draft.title.slice(0, MINDFULNESS_NOTE_TITLE_MAX_LENGTH),
      content: draft.content.slice(0, MINDFULNESS_NOTE_CONTENT_MAX_LENGTH),
      editingNoteId: draft.editingNoteId,
      categoryId: draft.categoryId,
    }
  } catch {
    window.sessionStorage.removeItem(MINDFULNESS_NOTE_DRAFT_STORAGE_KEY)
    return null
  }
}

export function PathView() {
  const {
    profile,
    pathDayConfirmations,
    confirmPathDay,
    courseLessonCompletions,
    completeCourseLesson,
    mindfulnessCategories,
    mindfulnessNotes,
    addMindfulnessCategory,
    deleteMindfulnessCategory,
    addMindfulnessNote,
    updateMindfulnessNote,
    deleteMindfulnessNote,
  } = useData()
  const [savedNoteDraft] = useState<MindfulnessNoteDraft | null>(getSavedMindfulnessNoteDraft)
  const [subTab, setSubTab] = useState<PathSubTab>(getSavedPathSubTab)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [busyDay, setBusyDay] = useState<PathDay | null>(null)
  const [openCourseId, setOpenCourseId] = useState<string | null>(null)
  const [busyLesson, setBusyLesson] = useState<string | null>(null)
  const [shalomInfoOpen, setShalomInfoOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState(savedNoteDraft?.title ?? '')
  const [noteContent, setNoteContent] = useState(savedNoteDraft?.content ?? '')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(savedNoteDraft?.editingNoteId ?? null)
  const [noteCategoryId, setNoteCategoryId] = useState<string | null>(savedNoteDraft?.categoryId ?? null)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [noteFormOpen, setNoteFormOpen] = useState(savedNoteDraft !== null)
  const [shNoteFormOpen, setShNoteFormOpen] = useState(false)
  const [openedShNoteId, setOpenedShNoteId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryFormOpen, setNewCategoryFormOpen] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noteFormFullscreen, setNoteFormFullscreen] = useState(getSavedMindfulnessNoteFullscreenState)
  const [sabbathSchoolLinkDialogOpen, setSabbathSchoolLinkDialogOpen] = useState(false)

  useEffect(() => {
    window.sessionStorage.setItem(PATH_SUB_TAB_STORAGE_KEY, subTab)
  }, [subTab])

  useEffect(() => {
    if (!noteTitle && !noteContent && !editingNoteId) {
      window.sessionStorage.removeItem(MINDFULNESS_NOTE_DRAFT_STORAGE_KEY)
      return
    }

    window.sessionStorage.setItem(
      MINDFULNESS_NOTE_DRAFT_STORAGE_KEY,
      JSON.stringify({ title: noteTitle, content: noteContent, editingNoteId, categoryId: noteCategoryId }),
    )
  }, [editingNoteId, noteCategoryId, noteContent, noteTitle])

  useEffect(() => {
    window.sessionStorage.setItem(MINDFULNESS_NOTE_FULLSCREEN_STORAGE_KEY, String(noteFormFullscreen))
  }, [noteFormFullscreen])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!noteFormFullscreen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNoteFormFullscreen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [noteFormFullscreen])

  useEffect(() => {
    if (!sabbathSchoolLinkDialogOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSabbathSchoolLinkDialogOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sabbathSchoolLinkDialogOpen])

  const cycleStartedOn = getShabbatWeekStart(profile, currentTime)
  const confirmedDays = new Set(
    cycleStartedOn
      ? pathDayConfirmations
        .filter((confirmation) => confirmation.cycle_started_on === cycleStartedOn)
        .map((confirmation) => confirmation.day)
      : [],
  )

  async function handleDayConfirmation(day: PathDay, label: string) {
    if (!cycleStartedOn || confirmedDays.has(day) || busyDay) return
    if (!window.confirm(`Подтвердить «${label}»?`)) return

    setBusyDay(day)
    setError(null)
    try {
      await confirmPathDay(day, cycleStartedOn)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить подтверждение')
    } finally {
      setBusyDay(null)
    }
  }

  async function handleLessonCompletion(courseId: string, lessonNumber: number) {
    const lessonKey = `${courseId}:${lessonNumber}`
    const completed = courseLessonCompletions.some(
      (completion) => completion.course_id === courseId && completion.lesson_number === lessonNumber,
    )
    if (completed || busyLesson) return
    if (!window.confirm('Урок завершен?')) return

    setBusyLesson(lessonKey)
    setError(null)
    try {
      await completeCourseLesson(courseId, lessonNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить подтверждение урока')
    } finally {
      setBusyLesson(null)
    }
  }

  function handleShalomWebsiteClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    if (!window.confirm('Вы точно хотите перейти на сайт Школы Шалом?')) return
    window.open('https://alexbolotnikov.org/', '_blank', 'noopener,noreferrer')
  }

  function handleSabbathSchoolWebsiteClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    setSabbathSchoolLinkDialogOpen(true)
  }

  function openSabbathSchoolLessons(target: 'tab' | 'window') {
    if (target === 'tab') {
      window.open(SABBATH_SCHOOL_LESSONS_URL, '_blank', 'noopener,noreferrer')
    } else {
      window.open(SABBATH_SCHOOL_LESSONS_URL, 'sabbath-school-lessons', 'noopener,noreferrer,popup,width=1100,height=800')
    }
    setSabbathSchoolLinkDialogOpen(false)
  }

  function resetNoteForm() {
    window.sessionStorage.removeItem(MINDFULNESS_NOTE_DRAFT_STORAGE_KEY)
    setNoteTitle('')
    setNoteContent('')
    setEditingNoteId(null)
    setNoteFormOpen(false)
    setShNoteFormOpen(false)
    setNewCategoryName('')
    setNewCategoryFormOpen(false)
  }

  function toggleNoteFormFullscreen() {
    setNoteFormFullscreen((fullscreen) => !fullscreen)
  }

  async function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = noteTitle.trim()
    const content = noteContent.trim()
    if (!title || !content || !selectedNoteCategoryId || busyNoteId) return

    const editedNoteId = editingNoteId
    const noteId = editedNoteId ?? 'new'
    setBusyNoteId(noteId)
    setError(null)
    try {
      if (editedNoteId) {
        await updateMindfulnessNote(editedNoteId, title, content, selectedNoteCategoryId)
        setNoteTitle(title)
        setNoteContent(content)
      } else {
        const note = await addMindfulnessNote(title, content, selectedNoteCategoryId)
        setEditingNoteId(note.id)
        setNoteTitle(note.title)
        setNoteContent(note.content)
        setNoteCategoryId(note.category_id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить заметку')
    } finally {
      setBusyNoteId(null)
    }
  }

  function startNoteEditing(note: MindfulnessNote) {
    if (busyNoteId) return
    setNoteTitle(note.title)
    setNoteContent(note.content)
    setNoteCategoryId(note.category_id)
    setEditingNoteId(note.id)
    setNoteFormOpen(true)
    setError(null)
  }

  function startShNote() {
    if (busyNoteId || !saturdaySchoolCategoryId) return
    window.sessionStorage.removeItem(MINDFULNESS_NOTE_DRAFT_STORAGE_KEY)
    setNoteTitle('')
    setNoteContent('')
    setNoteCategoryId(saturdaySchoolCategoryId)
    setEditingNoteId(null)
    setShNoteFormOpen(true)
    setOpenedShNoteId(null)
    setError(null)
  }

  function startShNoteEditing(note: MindfulnessNote) {
    if (busyNoteId) return
    setNoteTitle(note.title)
    setNoteContent(note.content)
    setNoteCategoryId(note.category_id)
    setEditingNoteId(note.id)
    setShNoteFormOpen(true)
    setOpenedShNoteId(null)
    setError(null)
  }

  function startNewNote() {
    if (busyNoteId) return
    window.sessionStorage.removeItem(MINDFULNESS_NOTE_DRAFT_STORAGE_KEY)
    setNoteTitle('')
    setNoteContent('')
    setEditingNoteId(null)
    setNoteCategoryId(selectedActiveCategoryId)
    setNewCategoryName('')
    setNewCategoryFormOpen(false)
    setNoteFormOpen(true)
    setError(null)
  }

  async function handleCategoryAddition() {
    const name = newCategoryName.trim()
    if (!name || savingCategory) return

    setSavingCategory(true)
    setError(null)
    try {
      const category = await addMindfulnessCategory(name)
      setNoteCategoryId(category.id)
      setActiveCategoryId(category.id)
      setNewCategoryName('')
      setNewCategoryFormOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить категорию')
    }
    finally {
      setSavingCategory(false)
    }
  }

  async function handleCategoryDeletion(categoryId: string, categoryName: string) {
    const unsortedCategory = mindfulnessCategories.find((category) => category.name === 'Неотсортированные')
    if (!unsortedCategory || deletingCategoryId) return
    const notesCount = mindfulnessNotes.filter((note) => note.category_id === categoryId).length
    const message = notesCount
      ? `Удалить категорию «${categoryName}»? ${notesCount} ${notesCount === 1 ? 'запись будет перенесена' : 'записей будут перенесены'} в «Неотсортированные».`
      : `Удалить категорию «${categoryName}»?`
    if (!window.confirm(message)) return

    setDeletingCategoryId(categoryId)
    setError(null)
    try {
      await deleteMindfulnessCategory(categoryId, unsortedCategory.id)
      if (activeCategoryId === categoryId) setActiveCategoryId(unsortedCategory.id)
      if (noteCategoryId === categoryId) setNoteCategoryId(unsortedCategory.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить категорию')
    } finally {
      setDeletingCategoryId(null)
    }
  }

  const saturdaySchoolCategoryId = mindfulnessCategories.find((category) => category.name === 'Субботняя школа')?.id ?? null
  const defaultMindfulnessCategoryId = saturdaySchoolCategoryId ?? mindfulnessCategories[0]?.id ?? null
  const selectedActiveCategoryId = mindfulnessCategories.some((category) => category.id === activeCategoryId)
    ? activeCategoryId
    : defaultMindfulnessCategoryId
  const selectedNoteCategoryId = mindfulnessCategories.some((category) => category.id === noteCategoryId)
    ? noteCategoryId
    : defaultMindfulnessCategoryId
  const visibleMindfulnessNotes = mindfulnessNotes.filter((note) => note.category_id === selectedActiveCategoryId)
  const saturdaySchoolNotes = mindfulnessNotes.filter((note) => note.category_id === saturdaySchoolCategoryId)
  const openedShNote = saturdaySchoolNotes.find((note) => note.id === openedShNoteId) ?? null

  async function handleNoteDeletion(note: MindfulnessNote) {
    if (busyNoteId || !window.confirm(`Удалить заметку «${note.title}»?`)) return
    setBusyNoteId(note.id)
    setError(null)
    try {
      await deleteMindfulnessNote(note.id)
      if (editingNoteId === note.id) resetNoteForm()
      if (openedShNoteId === note.id) setOpenedShNoteId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить заметку')
    } finally {
      setBusyNoteId(null)
    }
  }

  return (
    <section className="path-view">
      <nav className="calories-tabs" aria-label="Разделы Пути">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={subTab === tab.id ? 'calories-tab active' : 'calories-tab'}
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {subTab === 'bible' ? <BibleView /> : subTab === 'sh' ? (
        <div className="path-sh-card">
          <GrapevineOrnament />
          <div className="path-sh-content">
            <h2>Субботняя Школа</h2>
            <p className="path-sh-description">
              <a
                href="https://esd.adventist.org/library/periodicals/sabbath-school/adult-sabbath-school/"
                onClick={handleSabbathSchoolWebsiteClick}
              >
                Ссылка на уроки
              </a>
            </p>
            {cycleStartedOn ? (
              <div className="path-days" aria-label="Подтверждение дней">
                <DaysGrapevineOrnament />
                {PATH_DAYS.map((day) => {
                  const confirmed = confirmedDays.has(day.id)
                  return (
                    <button
                      key={day.id}
                      type="button"
                      className={confirmed ? 'path-day confirmed' : 'path-day'}
                      disabled={confirmed || busyDay !== null}
                      onClick={() => void handleDayConfirmation(day.id, day.label)}
                    >
                      <span>{day.label}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="banner error">Выберите город и часовой пояс в настройках, чтобы учитывать заход солнца.</p>
            )}
            <section className="path-sh-notes" aria-label="Заметки Субботней школы">
              <div className="path-sh-notes-heading">
                <h3>Заметки</h3>
                <button type="button" className="add-button" onClick={startShNote} disabled={busyNoteId !== null || !saturdaySchoolCategoryId}>
                  Добавить заметку
                </button>
              </div>
              {shNoteFormOpen && (
                <form className={noteFormFullscreen ? 'mindfulness-note-form fullscreen' : 'mindfulness-note-form'} onSubmit={(event) => void handleNoteSubmit(event)}>
                  <div className="mindfulness-note-form-heading">
                    <strong>{editingNoteId ? 'Редактирование темы' : 'Новая запись'}</strong>
                    <button type="button" className="mindfulness-fullscreen-button" onClick={toggleNoteFormFullscreen} aria-pressed={noteFormFullscreen}>
                      {noteFormFullscreen ? 'Свернуть' : 'На весь экран'}
                    </button>
                  </div>
                  <label>
                    Название темы
                    <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} maxLength={MINDFULNESS_NOTE_TITLE_MAX_LENGTH} placeholder="Например: Тема №1" disabled={busyNoteId !== null} required />
                  </label>
                  <label>
                    Категория
                    <input value="Субботняя школа" disabled />
                  </label>
                  <label className="mindfulness-note-content-field">
                    Краткий конспект или комментарий
                    <textarea value={noteContent} onChange={(event) => setNoteContent(event.target.value)} maxLength={MINDFULNESS_NOTE_CONTENT_MAX_LENGTH} placeholder="Запишите главные мысли, выводы или вопросы по теме" rows={6} disabled={busyNoteId !== null} required />
                  </label>
                  <div className="mindfulness-form-footer">
                    <span>{noteContent.length} / {MINDFULNESS_NOTE_CONTENT_MAX_LENGTH}</span>
                    <div className="mindfulness-form-actions">
                      <button type="button" className="add-button" onClick={resetNoteForm} disabled={busyNoteId !== null}>Отмена</button>
                      <button type="submit" className="add-button" disabled={busyNoteId !== null}>{busyNoteId ? 'Сохранение…' : editingNoteId ? 'Сохранить изменения' : 'Сохранить'}</button>
                    </div>
                  </div>
                </form>
              )}
              {saturdaySchoolNotes.length ? (
                <div className="path-sh-note-list">
                  {saturdaySchoolNotes.map((note) => (
                    <button key={note.id} type="button" className={openedShNoteId === note.id ? 'path-sh-note-title active' : 'path-sh-note-title'} onClick={() => setOpenedShNoteId((current) => current === note.id ? null : note.id)}>
                      {note.title}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="path-sh-empty-notes">Пока нет заметок по Субботней школе.</p>
              )}
              {openedShNote && !(shNoteFormOpen && editingNoteId === openedShNote.id) && (
                <article className="path-sh-note-detail">
                  <div>
                    <h4>{openedShNote.title}</h4>
                    <p>{openedShNote.content}</p>
                  </div>
                  <div className="mindfulness-note-actions">
                    <button type="button" className="edit-button" aria-label={`Редактировать «${openedShNote.title}»`} onClick={() => startShNoteEditing(openedShNote)} disabled={busyNoteId !== null}>✎</button>
                    <button type="button" className="delete-button" aria-label={`Удалить «${openedShNote.title}»`} onClick={() => void handleNoteDeletion(openedShNote)} disabled={busyNoteId !== null}>×</button>
                  </div>
                </article>
              )}
            </section>
            {error && <p className="banner error">{error}</p>}
          </div>
          <GrapevineOrnament mirrored />
        </div>
      ) : subTab === 'shalom-school' ? (
        <section className="shalom-school">
          <div className="shalom-school-heading">
            <h2>Школа Шалом</h2>
            <button
              type="button"
              className="info-button"
              aria-label="Информация о Школе Шалом"
              aria-expanded={shalomInfoOpen}
              aria-controls="shalom-school-info"
              onClick={() => setShalomInfoOpen((open) => !open)}
            >
              i
            </button>
            {shalomInfoOpen && (
              <p id="shalom-school-info" className="shalom-school-info">
                Вы можете перейти на сайт Школы Шалом Александра Болотникова{' '}
                <a href="https://alexbolotnikov.org/" onClick={handleShalomWebsiteClick}>тут</a>
              </p>
            )}
          </div>
          <div className="shalom-courses">
            {SHALOM_COURSES.map((course) => {
              const open = openCourseId === course.id
              const completedLessons = courseLessonCompletions.filter(
                (completion) => completion.course_id === course.id,
              ).length
              return (
                <section key={course.id} className="shalom-course">
                  <button
                    type="button"
                    className={open ? 'shalom-course-toggle open' : 'shalom-course-toggle'}
                    aria-expanded={open}
                    onClick={() => setOpenCourseId((current) => current === course.id ? null : course.id)}
                  >
                    <span>{course.title}</span>
                    <span className="shalom-course-progress">{completedLessons}/{course.lessons}</span>
                  </button>
                  {open && (
                    <div className="shalom-lessons" aria-label={`Уроки курса «${course.title}»`}>
                      {Array.from({ length: course.lessons }, (_, index) => {
                        const lessonNumber = index + 1
                        const completed = courseLessonCompletions.some(
                          (completion) => completion.course_id === course.id && completion.lesson_number === lessonNumber,
                        )
                        return (
                          <button
                            key={lessonNumber}
                            type="button"
                            className={completed ? 'shalom-lesson completed' : 'shalom-lesson'}
                            disabled={completed || busyLesson !== null}
                            onClick={() => void handleLessonCompletion(course.id, lessonNumber)}
                          >
                            Урок {lessonNumber}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
          {error && <p className="banner error">{error}</p>}
        </section>
      ) : subTab === 'mindfulness-practicum' ? (
        <section className="mindfulness-practicum">
          <div className="mindfulness-heading">
            <div>
              <h2>Практикум осознанности</h2>
              <p>Сохраняйте темы и краткие конспекты для личной работы.</p>
            </div>
            <span className="mindfulness-limit">До 7 000 символов в заметке</span>
          </div>
          <div className="mindfulness-category-tabs" aria-label="Категории записей">
            <button type="button" className="add-button" onClick={startNewNote} disabled={busyNoteId !== null || !mindfulnessCategories.length}>
              Новая запись
            </button>
            {mindfulnessCategories.map((category) => {
              const isDefaultCategory = category.name === 'Субботняя школа' || category.name === 'Неотсортированные'
              return (
                <div key={category.id} className="mindfulness-category-control">
                  <button
                    type="button"
                    className={selectedActiveCategoryId === category.id ? 'mindfulness-category-button active' : 'mindfulness-category-button'}
                    onClick={() => setActiveCategoryId(category.id)}
                    disabled={deletingCategoryId !== null}
                  >
                    {category.name}
                  </button>
                  {!isDefaultCategory && (
                    <button
                      type="button"
                      className="mindfulness-category-delete"
                      aria-label={`Удалить категорию «${category.name}»`}
                      onClick={() => void handleCategoryDeletion(category.id, category.name)}
                      disabled={deletingCategoryId !== null}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {noteFormOpen && (
          <form
            className={noteFormFullscreen ? 'mindfulness-note-form fullscreen' : 'mindfulness-note-form'}
            onSubmit={(event) => void handleNoteSubmit(event)}
          >
            <div className="mindfulness-note-form-heading">
              <strong>{editingNoteId ? 'Редактирование темы' : 'Новая тема'}</strong>
              <button
                type="button"
                className="mindfulness-fullscreen-button"
                onClick={toggleNoteFormFullscreen}
                aria-pressed={noteFormFullscreen}
              >
                {noteFormFullscreen ? 'Свернуть' : 'На весь экран'}
              </button>
            </div>
            <label>
              Название темы
              <input
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                maxLength={MINDFULNESS_NOTE_TITLE_MAX_LENGTH}
                placeholder="Например: Тема №1"
                disabled={busyNoteId !== null}
                required
              />
            </label>
            <label>
              Категория
              <select
                value={selectedNoteCategoryId ?? ''}
                onChange={(event) => setNoteCategoryId(event.target.value)}
                disabled={busyNoteId !== null || savingCategory}
                required
              >
                {mindfulnessCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <div className="mindfulness-category-addition">
              <button type="button" className="mindfulness-fullscreen-button" onClick={() => setNewCategoryFormOpen((open) => !open)} disabled={busyNoteId !== null || savingCategory}>
                Добавить новую категорию
              </button>
              {newCategoryFormOpen && (
                <div className="mindfulness-new-category-form">
                  <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} maxLength={80} placeholder="Название категории" disabled={busyNoteId !== null || savingCategory} />
                  <button type="button" className="add-button" onClick={() => void handleCategoryAddition()} disabled={!newCategoryName.trim() || busyNoteId !== null || savingCategory}>
                    {savingCategory ? 'Добавление…' : 'Добавить'}
                  </button>
                </div>
              )}
            </div>
            <label className="mindfulness-note-content-field">
              Краткий конспект или комментарий
              <textarea
                value={noteContent}
                onChange={(event) => setNoteContent(event.target.value)}
                maxLength={MINDFULNESS_NOTE_CONTENT_MAX_LENGTH}
                placeholder="Запишите главные мысли, выводы или вопросы по теме"
                rows={6}
                disabled={busyNoteId !== null}
                required
              />
            </label>
            <div className="mindfulness-form-footer">
              <span>{noteContent.length} / {MINDFULNESS_NOTE_CONTENT_MAX_LENGTH}</span>
              <div className="mindfulness-form-actions">
                <button type="button" className="add-button" onClick={resetNoteForm} disabled={busyNoteId !== null}>
                  Отмена
                </button>
                <button type="submit" className="add-button" disabled={busyNoteId !== null}>
                  {busyNoteId ? 'Сохранение…' : editingNoteId ? 'Сохранить изменения' : 'Сохранить'}
                </button>
              </div>
            </div>
          </form>
          )}
          {visibleMindfulnessNotes.length ? (
            <div className="mindfulness-notes">
              {visibleMindfulnessNotes.map((note) => (
                <article key={note.id} className="mindfulness-note">
                  <div className="mindfulness-note-content">
                    <h3>{note.title}</h3>
                    <p>{note.content}</p>
                  </div>
                  <div className="mindfulness-note-actions">
                    <button type="button" className="edit-button" aria-label={`Редактировать «${note.title}»`} onClick={() => startNoteEditing(note)} disabled={busyNoteId !== null}>✎</button>
                    <button type="button" className="delete-button" aria-label={`Удалить «${note.title}»`} onClick={() => void handleNoteDeletion(note)} disabled={busyNoteId !== null}>×</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">В этой категории пока нет записей.</div>
          )}
          {error && <p className="banner error">{error}</p>}
        </section>
      ) : null}
      {sabbathSchoolLinkDialogOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSabbathSchoolLinkDialogOpen(false)}>
          <section
            className="sabbath-school-link-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sabbath-school-link-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="sabbath-school-link-dialog-title">Открыть ссылку на уроки?</h2>
            <div className="sabbath-school-link-dialog-actions">
              <button type="button" className="add-button" onClick={() => openSabbathSchoolLessons('tab')}>
                В новой вкладке
              </button>
              <button type="button" className="add-button" onClick={() => openSabbathSchoolLessons('window')}>
                В новом окне
              </button>
              <button type="button" className="sabbath-school-link-cancel" onClick={() => setSabbathSchoolLinkDialogOpen(false)}>
                Отмена
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

function GrapevineOrnament({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg className={mirrored ? 'grapevine-ornament mirrored' : 'grapevine-ornament'} viewBox="0 0 240 64" aria-hidden="true">
      <path d="M4 48C48 54 38 7 83 20s37 35 77 20 39-38 76-18" />
      <path d="M55 35c-16-19-30-7-24 5 5 10 21 6 24-5Z" />
      <path d="M113 29c-14-18-29-6-23 7 6 10 21 5 23-7Z" />
      <path d="M173 31c16-18 30-3 22 8-7 9-21 3-22-8Z" />
      <g className="grape-cluster">
        <circle cx="72" cy="39" r="4" /><circle cx="80" cy="42" r="4" /><circle cx="76" cy="49" r="4" />
      </g>
      <g className="grape-cluster">
        <circle cx="151" cy="36" r="4" /><circle cx="159" cy="39" r="4" /><circle cx="155" cy="46" r="4" />
      </g>
    </svg>
  )
}

function DaysGrapevineOrnament() {
  return (
    <svg className="days-grapevine-ornament" viewBox="0 0 700 74" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-8 57C46 62 42 16 108 26s60 29 125 13 59-34 125-14 60 34 126 16 62-34 126-13 55 31 98 13" />
      <path d="M72 43c-17-21-33-6-24 7 7 10 21 5 24-7Z" />
      <path d="M174 42c18-20 33-4 23 9-8 10-22 3-23-9Z" />
      <path d="M291 42c-17-21-33-6-24 7 7 10 21 5 24-7Z" />
      <path d="M407 42c18-20 33-4 23 9-8 10-22 3-23-9Z" />
      <path d="M523 42c-17-21-33-6-24 7 7 10 21 5 24-7Z" />
      <path d="M638 42c18-20 33-4 23 9-8 10-22 3-23-9Z" />
      <g>
        <circle cx="127" cy="42" r="4" /><circle cx="135" cy="45" r="4" /><circle cx="131" cy="52" r="4" />
        <circle cx="353" cy="42" r="4" /><circle cx="361" cy="45" r="4" /><circle cx="357" cy="52" r="4" />
        <circle cx="578" cy="42" r="4" /><circle cx="586" cy="45" r="4" /><circle cx="582" cy="52" r="4" />
      </g>
    </svg>
  )
}
