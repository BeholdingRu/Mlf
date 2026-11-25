import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from 'react'

type TaskOrderDragOptions = {
  enabled: boolean
  onDrop: (taskId: string, targetTaskId: string) => void
  canDelete?: (taskId: string) => boolean
  onDelete?: (taskId: string) => void
}

type ActiveGesture = {
  cancel: () => void
  moveTouch?: (event: globalThis.TouchEvent) => void
}

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [contenteditable="true"], [role="button"]'
const ROW_SELECTOR = '[data-task-order-id]'
const TRASH_SELECTOR = '[data-task-order-trash]'
const LONG_PRESS_MS = 350
const TOUCH_TOLERANCE = 10
const POINTER_DISTANCE = 6

function getScrollContainer(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    if (/(auto|scroll)/.test(window.getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

export function useTaskOrderDrag({ enabled, onDrop, canDelete, onDelete }: TaskOrderDragOptions) {
  const [drag, setDrag] = useState<{
    activeTaskId: string | null
    overTaskId: string | null
    overTrash: boolean
  }>({
    activeTaskId: null,
    overTaskId: null,
    overTrash: false,
  })
  const gestureRef = useRef<ActiveGesture | null>(null)
  const onDropRef = useRef(onDrop)
  const canDeleteRef = useRef(canDelete)
  const onDeleteRef = useRef(onDelete)
  onDropRef.current = onDrop
  canDeleteRef.current = canDelete
  onDeleteRef.current = onDelete

  useEffect(() => {
    if (!enabled) {
      gestureRef.current?.cancel()
      return
    }
    // Install before a touch starts: Safari needs a non-passive touchmove
    // listener in place before the long press can take over from scrolling.
    const moveTouch = (event: globalThis.TouchEvent) => gestureRef.current?.moveTouch?.(event)
    document.addEventListener('touchmove', moveTouch, { passive: false })
    return () => {
      gestureRef.current?.cancel()
      document.removeEventListener('touchmove', moveTouch)
    }
  }, [enabled])

  function startGesture(
    element: HTMLLIElement,
    taskId: string,
    groupId: string,
    startX: number,
    startY: number,
    pointerId: number | null,
    touchId: number | null,
  ) {
    if (!enabled || gestureRef.current) return
    const list = element.parentElement
    if (!list) return
    const scrollContainer = getScrollContainer(element)
    const startWindowScroll = window.scrollY
    const startContainerScroll = scrollContainer?.scrollTop ?? 0
    let active = false
    let finished = false
    let lastX = startX
    let lastY = startY
    let offset = 0
    let overTaskId: string | null = taskId
    let overTrash = false
    let longPressTimer = 0
    let scrollFrame = 0

    function updatePosition() {
      offset = lastY - startY + window.scrollY - startWindowScroll
        + (scrollContainer?.scrollTop ?? 0) - startContainerScroll
      element.style.setProperty('--task-order-drag-offset', `${offset}px`)
      const listRect = list!.getBoundingClientRect()
      const scrollRect = scrollContainer?.getBoundingClientRect()
      const left = Math.max(0, listRect.left, scrollRect?.left ?? 0)
      const right = Math.min(window.innerWidth, listRect.right, scrollRect?.right ?? window.innerWidth)
      const top = Math.max(0, listRect.top, scrollRect?.top ?? 0)
      const bottom = Math.min(window.innerHeight, listRect.bottom, scrollRect?.bottom ?? window.innerHeight)
      let targetId: string | null = null
      const trash = document.querySelector<HTMLElement>(TRASH_SELECTOR)
      const trashRect = trash?.getBoundingClientRect()
      const trashScrollRect = trash ? getScrollContainer(trash)?.getBoundingClientRect() : undefined
      const insideTrash = !!trash && !!trashRect && trashRect.width > 0 && trashRect.height > 0
        && window.getComputedStyle(trash).visibility !== 'hidden'
        && lastX >= Math.max(0, trashRect.left, trashScrollRect?.left ?? 0)
        && lastX <= Math.min(window.innerWidth, trashRect.right, trashScrollRect?.right ?? window.innerWidth)
        && lastY >= Math.max(0, trashRect.top, trashScrollRect?.top ?? 0)
        && lastY <= Math.min(window.innerHeight, trashRect.bottom, trashScrollRect?.bottom ?? window.innerHeight)
      overTrash = insideTrash && !trash!.matches(':disabled')
        && !!canDeleteRef.current?.(taskId) && !!onDeleteRef.current
      if (!insideTrash && lastX >= left && lastX <= right && lastY >= top && lastY <= bottom) {
        let distance = Infinity
        list!.querySelectorAll<HTMLLIElement>(ROW_SELECTOR).forEach((row) => {
          if (row.dataset.taskOrderGroup !== groupId) return
          const rect = row.getBoundingClientRect()
          const center = (rect.top + rect.bottom) / 2 - (row === element ? offset : 0)
          const rowDistance = Math.abs(lastY - center)
          if (rowDistance < distance) {
            distance = rowDistance
            targetId = row.dataset.taskOrderId ?? null
          }
        })
      }
      overTaskId = targetId
      setDrag((current) => current.activeTaskId === taskId && current.overTaskId === targetId && current.overTrash === overTrash
        ? current
        : { activeTaskId: taskId, overTaskId: targetId, overTrash })
    }

    function autoScroll() {
      if (!active || finished) return
      const bounds = scrollContainer?.getBoundingClientRect()
      const top = Math.max(0, bounds?.top ?? 0)
      const bottom = Math.min(window.innerHeight, bounds?.bottom ?? window.innerHeight)
      const edge = 48
      const speed = lastY < top + edge
        ? -Math.min(14, Math.max(0, (top + edge - lastY) / 3))
        : lastY > bottom - edge
          ? Math.min(14, Math.max(0, (lastY - bottom + edge) / 3))
          : 0
      if (speed !== 0) {
        if (scrollContainer) scrollContainer.scrollTop += speed
        else window.scrollBy(0, speed)
        updatePosition()
      }
      scrollFrame = window.requestAnimationFrame(autoScroll)
    }

    function activate() {
      if (finished || !element.isConnected) return cancel()
      active = true
      if (pointerId !== null) {
        try { element.setPointerCapture(pointerId) } catch { cancel(); return }
      }
      window.getSelection()?.removeAllRanges()
      updatePosition()
      scrollFrame = window.requestAnimationFrame(autoScroll)
    }

    function cleanup() {
      finished = true
      window.clearTimeout(longPressTimer)
      window.cancelAnimationFrame(scrollFrame)
      gestureRef.current = null
      document.removeEventListener('pointermove', movePointer)
      document.removeEventListener('pointerup', endPointer)
      document.removeEventListener('pointercancel', cancelPointer)
      element.removeEventListener('lostpointercapture', cancel)
      document.removeEventListener('touchend', endTouch)
      document.removeEventListener('touchcancel', cancel)
      document.removeEventListener('touchstart', additionalTouch)
      document.removeEventListener('keydown', escape)
      document.removeEventListener('visibilitychange', visibilityChange)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('resize', cancel)
      element.style.removeProperty('--task-order-drag-offset')
      if (pointerId !== null && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId)
      setDrag({ activeTaskId: null, overTaskId: null, overTrash: false })
    }

    function cancel() {
      if (!finished) cleanup()
    }

    function finish() {
      if (finished) return
      const targetId = active ? overTaskId : null
      const shouldDelete = active && overTrash && !!canDeleteRef.current?.(taskId)
      cleanup()
      if (shouldDelete) onDeleteRef.current?.(taskId)
      else if (targetId !== null && targetId !== taskId) onDropRef.current(taskId, targetId)
    }

    function movePointer(event: globalThis.PointerEvent) {
      if (event.pointerId !== pointerId) return
      lastX = event.clientX
      lastY = event.clientY
      if (!active && Math.hypot(lastX - startX, lastY - startY) >= POINTER_DISTANCE) activate()
      if (active) {
        event.preventDefault()
        updatePosition()
      }
    }

    function endPointer(event: globalThis.PointerEvent) {
      if (event.pointerId !== pointerId) return
      if (active) {
        lastX = event.clientX
        lastY = event.clientY
        updatePosition()
      }
      finish()
    }

    function cancelPointer(event: globalThis.PointerEvent) {
      if (event.pointerId === pointerId || (touchId !== null && event.pointerType === 'touch')) cancel()
    }

    function moveTouch(event: globalThis.TouchEvent) {
      if (event.touches.length !== 1) return cancel()
      const touch = Array.from(event.touches).find((item) => item.identifier === touchId)
      if (!touch) return cancel()
      lastX = touch.clientX
      lastY = touch.clientY
      if (!active) {
        if (Math.hypot(lastX - startX, lastY - startY) > TOUCH_TOLERANCE) cancel()
        return
      }
      if (!event.cancelable) return cancel()
      event.preventDefault()
      updatePosition()
    }

    function endTouch(event: globalThis.TouchEvent) {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === touchId)
      if (!touch) return
      if (active) {
        if (event.cancelable) event.preventDefault()
        lastX = touch.clientX
        lastY = touch.clientY
        updatePosition()
      }
      finish()
    }

    function additionalTouch(event: globalThis.TouchEvent) {
      if (event.touches.length > 1) cancel()
    }

    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') cancel()
    }

    function visibilityChange() {
      if (document.visibilityState !== 'visible') cancel()
    }

    gestureRef.current = { cancel, moveTouch: touchId !== null ? moveTouch : undefined }
    if (touchId !== null) {
      longPressTimer = window.setTimeout(activate, LONG_PRESS_MS)
      document.addEventListener('touchend', endTouch, { passive: false })
      document.addEventListener('touchcancel', cancel)
      document.addEventListener('touchstart', additionalTouch, { passive: true })
    } else {
      document.addEventListener('pointermove', movePointer, { passive: false })
      document.addEventListener('pointerup', endPointer)
      element.addEventListener('lostpointercapture', cancel)
    }
    document.addEventListener('pointercancel', cancelPointer)
    document.addEventListener('keydown', escape)
    document.addEventListener('visibilitychange', visibilityChange)
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', cancel)
  }

  function rowProps(taskId: string, groupId: string) {
    return {
      'data-task-order-id': taskId,
      'data-task-order-group': groupId,
      onPointerDown(event: PointerEvent<HTMLLIElement>) {
        if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return
        if ((event.target as Element).closest(INTERACTIVE_SELECTOR)) return
        startGesture(event.currentTarget, taskId, groupId, event.clientX, event.clientY, event.pointerId, null)
      },
      onTouchStart(event: TouchEvent<HTMLLIElement>) {
        if (event.touches.length !== 1) {
          gestureRef.current?.cancel()
          return
        }
        if ((event.target as Element).closest(INTERACTIVE_SELECTOR)) return
        const touch = event.touches[0]
        startGesture(event.currentTarget, taskId, groupId, touch.clientX, touch.clientY, null, touch.identifier)
      },
      onContextMenu(event: React.MouseEvent<HTMLLIElement>) {
        if (enabled) event.preventDefault()
      },
    }
  }

  return { ...drag, rowProps }
}
