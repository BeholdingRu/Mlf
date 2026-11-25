import { useEffect, useId, useRef, useState } from 'react'
import type { Task } from '../lib/types'
import {
  normalizeTaskSeparatorStyle,
  TASK_SEPARATOR_STYLES,
  type TaskSeparatorStyle,
} from '../lib/task-separator-styles'
import { TaskSeparatorVisual } from './TaskSeparatorVisual'
import './TaskSeparatorAppearanceModal.css'

type TaskSeparatorAppearanceModalProps = {
  separator: Task
  onClose: () => void
  onSave: (style: TaskSeparatorStyle) => Promise<void>
}

export function TaskSeparatorAppearanceModal({
  separator,
  onClose,
  onSave,
}: TaskSeparatorAppearanceModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const groupId = useId()
  const [selectedStyle, setSelectedStyle] = useState(() => normalizeTaskSeparatorStyle(separator.separator_style))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const currentStyle = normalizeTaskSeparatorStyle(separator.separator_style)
  const selectedOption = TASK_SEPARATOR_STYLES.find((option) => option.id === selectedStyle)!

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement
    if (!dialog.open) dialog.showModal()
    return () => {
      dialog.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    if (busy) dialogRef.current?.focus()
  }, [busy])

  function close() {
    if (!savingRef.current) onClose()
  }

  async function save() {
    if (savingRef.current) return
    if (selectedStyle === currentStyle) {
      onClose()
      return
    }
    savingRef.current = true
    setBusy(true)
    setError(null)
    try {
      await onSave(selectedStyle)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить вид разделителя. Попробуйте ещё раз.')
    } finally {
      savingRef.current = false
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="separator-appearance-dialog"
      aria-labelledby={titleId}
      aria-busy={busy}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const dialog = event.currentTarget
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex]',
        )).filter((element) => (
          element.tabIndex >= 0
          && !element.matches(':disabled')
          && !element.matches('input[type="radio"]:not(:checked)')
          && element.getClientRects().length > 0
        ))
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (!first) {
          event.preventDefault()
          dialog.focus()
        } else if (active === dialog || !dialog.contains(active)) {
          event.preventDefault()
          const target = event.shiftKey ? last : first
          target.focus()
        } else if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <form
        className="separator-appearance-form"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <header className="separator-appearance-header">
          <div>
            <h2 id={titleId}>Вид разделителя</h2>
            <p>Выберите оформление для этой полосы.</p>
          </div>
          <button
            type="button"
            className="ghost compact separator-appearance-close"
            aria-label="Закрыть выбор вида разделителя"
            onClick={close}
            disabled={busy}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="separator-appearance-scroll">
          <div className="separator-appearance-preview">
            <span>{selectedOption.name}</span>
            <TaskSeparatorVisual style={selectedStyle} />
          </div>
          <fieldset className="separator-appearance-options" disabled={busy}>
            <legend>Варианты оформления</legend>
            <div className="separator-appearance-grid">
              {TASK_SEPARATOR_STYLES.map((option) => (
                <label
                  key={option.id}
                  className={`separator-appearance-choice${selectedStyle === option.id ? ' is-selected' : ''}`}
                >
                  <span className="separator-appearance-choice-title">
                    <input
                      type="radio"
                      name={groupId}
                      value={option.id}
                      checked={selectedStyle === option.id}
                      onChange={() => {
                        setSelectedStyle(option.id)
                        setError(null)
                      }}
                    />
                    <span>{option.name}</span>
                  </span>
                  <TaskSeparatorVisual style={option.id} />
                  <span className="separator-appearance-description">{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <footer className="separator-appearance-footer">
          {error && <p className="banner error" role="alert">{error}</p>}
          <div className="separator-appearance-actions">
            <button type="button" className="ghost" onClick={close} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}
