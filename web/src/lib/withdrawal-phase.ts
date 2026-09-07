import { daysInclusive, parseISODate, percent } from './dates'

const WITHDRAWAL_PHASE_INFO = {
  acute: 'Острая фаза. Начинается при снижении концентрации вещества в крови ниже порогового уровня. Для большинства веществ это происходит через 6–48 часов после последнего приёма. В этот период симптомы проявляются наиболее ярко: развиваются вегетативные кризы (потливость, тахикардия, тремор), тревога, бессонница или, наоборот, гиперсомния. Максимальная выраженность симптомов часто приходится на первые 1–4 дня.',
  subacute: 'Подострая (постабстинентная) фаза. Длится от нескольких дней до нескольких недель. Примечание автора: в моём случае она может длиться до 90 суток. Острые физические проявления стихают, но сохраняются нарушения сна, перепады настроения, раздражительность, трудности с концентрацией внимания и ангедония (неспособность получать удовольствие). Например, при отмене амфетамина эта фаза может длиться около трёх недель и характеризуется лёгкой гиперсомнией и повышенным аппетитом.',
  prolonged: 'Фаза длительного восстановления (пролонгированный синдром отмены — PAWS). Может продолжаться от нескольких месяцев до года и более. Это состояние не всегда фиксируется как острое заболевание, но проявляется волнообразно: внезапными приступами тяги, эмоциональной нестабильностью и астенией. Исследования показывают, что такая затяжная абстиненция характерна для отмены бензодиазепинов, антидепрессантов (СИОЗС) и длительного употребления опиоидов.',
  clean: 'В психологии есть понятие: «давно не делал» = «никогда не делал». Ваши нейронные связи свободны от зависимости, но помните: один раз алкоголик — навсегда алкоголик. Не позволяйте даже малейшему триггеру поколебать вас. Успехов!',
} as const

export function getWithdrawalPhase(
  withdrawalSyndrome: boolean,
  startedOn: string | null,
  restartOn: string | null,
  today: string,
) {
  if (!withdrawalSyndrome || !startedOn) return null

  if (restartOn && restartOn > today) {
    return { durationDays: 1, label: 'Подготовка', tone: 'preparing' as const, remainingDays: 1, preparing: true }
  }

  const effectiveStartedOn = restartOn && restartOn <= today ? restartOn : startedOn
  const elapsedDays = Math.max(daysInclusive(parseISODate(effectiveStartedOn), parseISODate(today)) - 1, 0)
  const phases = [
    { durationDays: 4, label: 'Острая фаза', tone: 'acute', info: WITHDRAWAL_PHASE_INFO.acute },
    { durationDays: 90, label: 'Подострая фаза', tone: 'subacute', info: WITHDRAWAL_PHASE_INFO.subacute },
    { durationDays: 636, label: 'Длительная фаза', tone: 'prolonged', info: WITHDRAWAL_PHASE_INFO.prolonged },
  ] as const
  let passedDays = 0

  for (const phase of phases) {
    const remainingDays = phase.durationDays - (elapsedDays - passedDays)
    if (remainingDays > 0) return { ...phase, remainingDays, preparing: false }
    passedDays += phase.durationDays
  }

  return {
    durationDays: 636,
    label: 'Чистота',
    tone: 'clean' as const,
    info: WITHDRAWAL_PHASE_INFO.clean,
    remainingDays: 0,
    freedomDays: elapsedDays,
    preparing: false,
    clean: true,
  }
}

export function withdrawalPhaseProgress(remainingDays: number, durationDays: number) {
  return percent(remainingDays, durationDays)
}
