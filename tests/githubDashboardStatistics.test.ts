import { expect, test } from 'bun:test';
import { selectContributionDays } from '../src/features/dashboard/workspace/statistics';
const days = [
  { date: '2026-09-30', contributions: 8 },
  { date: '2026-10-01', contributions: 0 },
  { date: '2026-10-02', contributions: 1 },
];
test('derives month totals from daily data and retains zero days', () => {
  expect(selectContributionDays(days, 'month', '2026-10-02')).toEqual([days[1], days[2]]);
});

import {
  contributionSummary,
  dailyLinePoints,
  periodBounds,
  shiftPeriod,
} from '../src/features/dashboard/workspace/statistics';
test('keeps daily precision in day, week and line views', () => {
  expect(selectContributionDays(days, 'day', '2026-10-01')).toEqual([days[1]]);
  expect(periodBounds('week', '2026-10-02')).toEqual({ start: '2026-09-28', end: '2026-10-05' });
  expect(contributionSummary(days)).toEqual({ total: 9, activeDays: 2, peak: 8 });
  expect(dailyLinePoints(days).map((point) => point.contributions)).toEqual([8, 0, 1]);
  expect(dailyLinePoints(days)).toHaveLength(3);
  expect(shiftPeriod('2026-03-31', 'month', -1)).toBe('2026-02-01');
});

import { adjacentStatisticsYear } from '../src/features/dashboard/workspace/statistics';
test('loads the adjacent year only when a visible week crosses a year boundary', () => {
  expect(adjacentStatisticsYear('week', '2026-01-01', '2026-10-19')).toBe(2025);
  expect(adjacentStatisticsYear('week', '2025-12-31', '2026-10-19')).toBe(2026);
  expect(adjacentStatisticsYear('month', '2026-01-01', '2026-10-19')).toBeUndefined();
  expect(adjacentStatisticsYear('week', '2026-12-31', '2026-12-31')).toBeUndefined();
});
