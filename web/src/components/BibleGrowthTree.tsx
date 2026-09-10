import type { CSSProperties } from 'react'

export function BibleGrowthTree({ progress }: { progress: number }) {
  const normalizedProgress = Math.max(0, Math.min(100, progress))
  if (normalizedProgress <= 0) return null

  const revealRadius = Math.sqrt(normalizedProgress / 100) * 72
  const style = {
    '--bible-tree-reveal-radius': `${revealRadius}%`,
  } as CSSProperties

  return (
    <div className="bible-growth-tree" aria-hidden="true">
      <div className="bible-growth-tree-art" style={style}>
        <img className="bible-growth-tree-image" src="/image/tree.png" alt="" />
      </div>
    </div>
  )
}
