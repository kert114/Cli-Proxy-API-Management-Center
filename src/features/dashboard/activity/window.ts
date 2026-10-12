export type ActivityPeriod = 'day' | 'week';

export function activityWindow(period: ActivityPeriod, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + (period === 'week' ? 7 : 1));
  return { since: start.toISOString(), until: end.toISOString() };
}
