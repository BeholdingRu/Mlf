import { daysInclusive, parseISODate, percent } from './dates'

export function getWithdrawalPhase(
  withdrawalSyndrome: boolean,
  startedOn: string | null,
  restartOn: string | null,
  today: string,
) {
  if (!withdrawalSyndrome || !startedOn) return null

  const effectiveStartedOn = restartOn && restartOn <= today ? restartOn : startedOn
  const elapsedDays = Math.max(daysInclusive(parseISODate(effectiveStartedOn), parseISODate(today)) - 1, 0)
  const totalElapsedInfo = `прошло всего ${elapsedDays} суток`

  if (restartOn && restartOn > today) {
    return {
      durationDays: 1,
      label: 'Подготовка',
      tone: 'preparing' as const,
      info: totalElapsedInfo,
      remainingDays: 1,
      preparing: true,
    }
  }

  const phases = [
    { durationDays: 4, label: 'Острая фаза', tone: 'acute' },
    { durationDays: 90, label: 'Подострая фаза', tone: 'subacute' },
    { durationDays: 636, label: 'Длительная фаза', tone: 'prolonged' },
  ] as const
  let passedDays = 0

  for (const phase of phases) {
    const remainingDays = phase.durationDays - (elapsedDays - passedDays)
    if (remainingDays > 0) return {
      ...phase,
      info: totalElapsedInfo,
      remainingDays,
      preparing: false,
    }
    passedDays += phase.durationDays
  }

  return {
    durationDays: 636,
    label: 'Чистота',
    tone: 'clean' as const,
    info: totalElapsedInfo,
    remainingDays: 0,
    freedomDays: elapsedDays,
    preparing: false,
    clean: true,
  }
}

export function withdrawalPhaseProgress(remainingDays: number, durationDays: number) {
  return percent(remainingDays, durationDays)
}
