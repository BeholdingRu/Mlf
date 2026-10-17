import { useLayoutEffect, useRef } from 'react'

type FluidSubtabIndicatorProps = {
  activeKey: string
}

const TAB_SELECTOR = ':scope > .daily-tasks-tab.active, :scope > .calories-tab.active'
const ALL_TABS_SELECTOR = ':scope > .daily-tasks-tab, :scope > .calories-tab'

export function FluidSubtabIndicator({ activeKey }: FluidSubtabIndicatorProps) {
  const indicatorRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const indicator = indicatorRef.current
    const tabList = indicator?.parentElement
    if (!indicator || !tabList) return undefined

    const updatePosition = () => {
      const activeTab = tabList.querySelector<HTMLElement>(TAB_SELECTOR)
      if (!activeTab) return

      indicator.style.setProperty('--fluid-tab-x', `${activeTab.offsetLeft}px`)
      indicator.style.setProperty('--fluid-tab-y', `${activeTab.offsetTop}px`)
      indicator.style.setProperty('--fluid-tab-width', `${activeTab.offsetWidth}px`)
      indicator.style.setProperty('--fluid-tab-height', `${activeTab.offsetHeight}px`)
    }

    let readyFrame = 0
    let movementTimer = 0
    const indicatorIsReady = tabList.dataset.fluidTabsReady === 'true'

    updatePosition()

    if (indicatorIsReady) {
      indicator.classList.remove('is-moving')
      void indicator.offsetWidth
      indicator.classList.add('is-moving')
      movementTimer = window.setTimeout(() => {
        indicator.classList.remove('is-moving')
      }, 560)
    } else {
      tabList.dataset.fluidTabsReady = 'false'
      readyFrame = window.requestAnimationFrame(() => {
        tabList.dataset.fluidTabsReady = 'true'
      })
    }

    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(tabList)
    tabList.querySelectorAll<HTMLElement>(ALL_TABS_SELECTOR).forEach((tab) => {
      resizeObserver.observe(tab)
    })

    return () => {
      window.cancelAnimationFrame(readyFrame)
      window.clearTimeout(movementTimer)
      resizeObserver.disconnect()
      indicator.classList.remove('is-moving')
    }
  }, [activeKey])

  return <span ref={indicatorRef} className="fluid-subtab-indicator" aria-hidden="true" />
}
