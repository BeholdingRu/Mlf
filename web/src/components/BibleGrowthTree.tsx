import type { CSSProperties } from 'react'
import { getGrowthRevealRadius } from '../lib/bible-growth'

export function BibleGrowthTree({ progress }: { progress: number }) {
  const normalizedProgress = Math.max(0, Math.min(100, progress))
  if (normalizedProgress <= 0) return null

  const revealRadius = getGrowthRevealRadius(normalizedProgress)
  const style = {
    '--bible-tree-reveal-radius': `${revealRadius}%`,
  } as CSSProperties

  return (
    <div className="bible-growth-tree" aria-hidden="true">
      <div className="bible-growth-tree-art" style={style}>
        <img className="bible-growth-tree-image" src="/image/test1.png" alt="" />
      </div>
    </div>
  )
}
