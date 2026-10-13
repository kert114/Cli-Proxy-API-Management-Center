export type ActivityPeriod = 'day' | 'week' | 'month' | 'year';
export const ACTIVITY_PERIODS: ActivityPeriod[] = ['day', 'week', 'month', 'year'];

export function activityWindow(period: ActivityPeriod, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === 'month' || period === 'year') start.setDate(1);
  if (period === 'year') start.setMonth(0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { since: start.toISOString(), until: end.toISOString() };
}
