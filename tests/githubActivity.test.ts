import { describe, expect, test } from 'bun:test';
import { activityWindow } from '../src/features/dashboard/activity/window';

describe('calendar activity windows', () => {
  test('week starts on Monday and stops at the next Monday in local time', () => {
    const now = new Date(2026, 9, 14, 15, 30);
    const window = activityWindow('week', now);
    expect(new Date(window.since)).toEqual(new Date(2026, 9, 12));
    expect(new Date(window.until)).toEqual(new Date(2026, 9, 19));
  });
});

test('day view includes Sunday without rolling it into the next week', () => {
  const now = new Date(2026, 9, 18, 15, 30);
  const day = activityWindow('day', now);
  expect(new Date(day.since)).toEqual(new Date(2026, 9, 18));
  expect(new Date(day.until)).toEqual(new Date(2026, 9, 19));
  expect(new Date(activityWindow('week', now).since)).toEqual(new Date(2026, 9, 12));
});

test('month view includes every day of a leap February', () => {
  const window = activityWindow('month', new Date(2024, 1, 17, 13));
  expect(new Date(window.since)).toEqual(new Date(2024, 1, 1));
  expect(new Date(window.until)).toEqual(new Date(2024, 2, 1));
});

test('year view includes the whole calendar year, including leap day', () => {
  const window = activityWindow('year', new Date(2024, 9, 17, 13));
  expect(new Date(window.since)).toEqual(new Date(2024, 0, 1));
  expect(new Date(window.until)).toEqual(new Date(2025, 0, 1));
});
