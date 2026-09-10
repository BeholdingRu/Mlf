export type WeightChartWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

type WeightChartWeekdayOption = {
  value: WeightChartWeekday
  short: string
  label: string
  recordsLabel: string
  emptyLabel: string
}

export const WEIGHT_CHART_WEEKDAYS: WeightChartWeekdayOption[] = [
  { value: 1, short: 'пн', label: 'Понедельник', recordsLabel: 'по понедельникам', emptyLabel: 'понедельник' },
  { value: 2, short: 'вт', label: 'Вторник', recordsLabel: 'по вторникам', emptyLabel: 'вторник' },
  { value: 3, short: 'ср', label: 'Среда', recordsLabel: 'по средам', emptyLabel: 'среду' },
  { value: 4, short: 'чт', label: 'Четверг', recordsLabel: 'по четвергам', emptyLabel: 'четверг' },
  { value: 5, short: 'пт', label: 'Пятница', recordsLabel: 'по пятницам', emptyLabel: 'пятницу' },
  { value: 6, short: 'сб', label: 'Суббота', recordsLabel: 'по субботам', emptyLabel: 'субботу' },
  { value: 0, short: 'вс', label: 'Воскресенье', recordsLabel: 'по воскресеньям', emptyLabel: 'воскресенье' },
]
