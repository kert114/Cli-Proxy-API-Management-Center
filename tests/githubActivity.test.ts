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
