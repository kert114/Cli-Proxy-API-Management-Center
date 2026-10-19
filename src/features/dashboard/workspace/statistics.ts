import type { ContributionDay } from '@/services/api/githubDashboard';
export type StatisticsPeriod = 'day' | 'week' | 'month' | 'year';
export const utcDate = (date: string) => new Date(`${date}T00:00:00Z`);
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function periodBounds(period: StatisticsPeriod, anchor: string) {
  const start = utcDate(anchor);
  if (period === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (period === 'month' || period === 'year') start.setUTCDate(1);
  if (period === 'year') start.setUTCMonth(0);
  const end = new Date(start);
  if (period === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else if (period === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + (period === 'week' ? 7 : 1));
  return { start: dateKey(start), end: dateKey(end) };
}
export function selectContributionDays(
  days: ContributionDay[],
  period: StatisticsPeriod,
  anchor: string
): ContributionDay[] {
  const { start, end } = periodBounds(period, anchor);
  return days.filter((day) => day.date >= start && day.date < end);
}
export function shiftPeriod(anchor: string, period: StatisticsPeriod, direction: number) {
  const date = utcDate(anchor);
  if (period === 'year') {
    date.setUTCDate(1);
    date.setUTCFullYear(date.getUTCFullYear() + direction);
  } else if (period === 'month') {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + direction);
  } else date.setUTCDate(date.getUTCDate() + direction * (period === 'week' ? 7 : 1));
  return dateKey(date);
}
export function contributionSummary(days: ContributionDay[]) {
  return {
    total: days.reduce((sum, day) => sum + day.contributions, 0),
    activeDays: days.filter((day) => day.contributions > 0).length,
    peak: Math.max(0, ...days.map((day) => day.contributions)),
  };
}
export function dailyLinePoints(days: ContributionDay[]) {
  const peak = Math.max(1, ...days.map((day) => day.contributions));
  return days.map((day, index) => ({
    ...day,
    x: days.length === 1 ? 500 : 30 + (index / (days.length - 1)) * 940,
    y: 174 - (day.contributions / peak) * 150,
  }));
}

export function adjacentStatisticsYear(
  period: StatisticsPeriod,
  anchor: string,
  today: string
): number | undefined {
  if (period !== 'week') return undefined;
  const { start, end } = periodBounds(period, anchor);
  const last = dateKey(new Date(Date.parse(`${end}T00:00:00Z`) - 86400000));
  const startYear = Math.max(2008, Number(start.slice(0, 4)));
  const endYear = Number((last > today ? today : last).slice(0, 4));
  const anchorYear = Number(anchor.slice(0, 4));
  return startYear !== anchorYear ? startYear : endYear !== anchorYear ? endYear : undefined;
}
