export const BIBLE_GROWTH_STAGE_STEPS = 334
export const BIBLE_GROWTH_TOTAL_STEPS = BIBLE_GROWTH_STAGE_STEPS * 2

export function getGrowthRevealRadius(progress: number) {
  const normalizedProgress = Math.max(0, Math.min(100, progress))
  return Math.sqrt(normalizedProgress / 100) * 72
}

export function getSequentialItemProgress(progress: number, index: number, itemCount: number) {
  if (itemCount <= 0) return 0
  const sequencePosition = Math.max(0, Math.min(100, progress)) / 100 * itemCount
  return Math.max(0, Math.min(1, sequencePosition - index))
}
