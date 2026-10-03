import type { Profile, WeightLog } from './types'

const CALORIES_PER_CHANGED_KILOGRAM = 10
const WEIGHT_COMPARISON_EPSILON = 1e-6

type CalorieAdaptationProfile = Pick<
  Profile,
  | 'calorie_adaptation_enabled'
  | 'calorie_adaptation_baseline_on'
  | 'calorie_adaptation_baseline_weight'
  | 'daily_calories_norm'
  | 'target_weight'
  | 'weight_started_on'
>

export type CalorieAdaptation = {
  baseNorm: number | null
  effectiveNorm: number | null
  fullWeightChangeKilograms: number
  calorieAdjustment: number
  baselineWeight: number | null
  baselineOn: string | null
  currentWeight: number | null
}

function finitePositiveNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function getCalorieAdaptation(
  profile: CalorieAdaptationProfile | null | undefined,
  weightLogs: readonly WeightLog[],
  onDate?: string,
): CalorieAdaptation {
  const baseNorm = finitePositiveNumber(profile?.daily_calories_norm)
  const eligibleLogs = weightLogs
    .filter((log) => !onDate || log.logged_on <= onDate)
    .map((log) => ({ ...log, numericValue: finitePositiveNumber(log.value) }))
    .filter((log): log is WeightLog & { numericValue: number } => log.numericValue !== null)
    .sort((left, right) => left.logged_on.localeCompare(right.logged_on))

  const earliestLog = eligibleLogs[0]
  const baselineWeight = finitePositiveNumber(profile?.calorie_adaptation_baseline_weight)
    ?? finitePositiveNumber(profile?.target_weight)
    ?? earliestLog?.numericValue
    ?? null
  const baselineOn = profile?.calorie_adaptation_baseline_on
    ?? profile?.weight_started_on
    ?? earliestLog?.logged_on
    ?? null
  const logsSinceBaseline = baselineOn
    ? eligibleLogs.filter((log) => log.logged_on >= baselineOn)
    : eligibleLogs
  const latestLog = logsSinceBaseline[logsSinceBaseline.length - 1]
  const currentWeight = latestLog?.numericValue ?? baselineWeight
  const appliesOnDate = !onDate || !baselineOn || onDate >= baselineOn
  const weightChange = appliesOnDate && baselineWeight !== null && currentWeight !== null
    ? currentWeight - baselineWeight
    : 0
  const fullWeightChangeKilograms = (
    Math.sign(weightChange) * Math.floor(Math.abs(weightChange) + WEIGHT_COMPARISON_EPSILON)
  ) || 0
  const calorieAdjustment = profile?.calorie_adaptation_enabled
    ? fullWeightChangeKilograms * CALORIES_PER_CHANGED_KILOGRAM
    : 0
  const effectiveNorm = baseNorm === null
    ? null
    : Math.max(0, baseNorm + calorieAdjustment)

  return {
    baseNorm,
    effectiveNorm,
    fullWeightChangeKilograms,
    calorieAdjustment,
    baselineWeight,
    baselineOn,
    currentWeight,
  }
}
