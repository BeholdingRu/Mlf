export const BIBLE_GROWTH_STAGE_STEPS = 334
export const BIBLE_GROWTH_TOTAL_STEPS = BIBLE_GROWTH_STAGE_STEPS * 2

export function getGrowthRevealRadius(progress: number) {
  const normalizedProgress = Math.max(0, Math.min(100, progress))
  return Math.sqrt(normalizedProgress / 100) * 72
}
