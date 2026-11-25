/**
 * Relative-time formatting for quota cards.
 */

import { describe, expect, test } from 'bun:test';
import {
  buildResetDisplay,
  formatInstantShort,
  formatQuotaResetTime,
  formatRelativeInstant,
  relativeTimeParts,
} from '@/utils/quota';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@/utils/time/durations';

const NOW = new Date(2026, 7, 2, 12, 0, 0).getTime();

describe('relativeTimeParts', () => {
  test('picks the coarsest unit that still describes the gap', () => {
    expect(relativeTimeParts(NOW + DAY_MS, NOW)).toEqual({ value: 1, unit: 'day' });
    expect(relativeTimeParts(NOW + HOUR_MS, NOW)).toEqual({ value: 1, unit: 'hour' });
    expect(relativeTimeParts(NOW + 30_000, NOW)).toEqual({ value: 1, unit: 'minute' });
  });

  test('never renders a magnitude that should have been the next unit up', () => {
    // Rounding up here would produce "24 hours" and "60 minutes".
    expect(relativeTimeParts(NOW + DAY_MS - 1, NOW)).toEqual({ value: 23, unit: 'hour' });
    expect(relativeTimeParts(NOW + HOUR_MS - 1, NOW)).toEqual({ value: 59, unit: 'minute' });
  });

  test('truncates, so a deadline never appears further off than it is', () => {
    expect(relativeTimeParts(NOW + 11 * DAY_MS + 1, NOW)).toEqual({ value: 11, unit: 'day' });
    expect(relativeTimeParts(NOW + 11 * DAY_MS + 23 * HOUR_MS, NOW)).toEqual({
      value: 11,
      unit: 'day',
    });
    expect(relativeTimeParts(NOW + 90 * MINUTE_MS, NOW)).toEqual({ value: 1, unit: 'hour' });
  });

  test('past instants are negative rather than clamped to zero', () => {
    // The timeline-local predecessor clamped with Math.max(0, …), so an expired
    // credit read "in 1 minute".
    expect(relativeTimeParts(NOW - 3 * DAY_MS, NOW)).toEqual({ value: -3, unit: 'day' });
    expect(relativeTimeParts(NOW - 2 * HOUR_MS, NOW)).toEqual({ value: -2, unit: 'hour' });
  });

  test('sub-minute magnitudes floor to 1 in both directions', () => {
    expect(relativeTimeParts(NOW + 1, NOW)).toEqual({ value: 1, unit: 'minute' });
    expect(relativeTimeParts(NOW, NOW)).toEqual({ value: 1, unit: 'minute' });
    expect(relativeTimeParts(NOW - 1, NOW)).toEqual({ value: -1, unit: 'minute' });
  });
});

describe('formatRelativeInstant', () => {
  test('renders in the requested locale', () => {
    expect(formatRelativeInstant(NOW + 11 * DAY_MS, NOW, 'en')).toContain('days');
    expect(formatRelativeInstant(NOW + 11 * DAY_MS, NOW, 'zh-CN')).toContain('天');
    expect(formatRelativeInstant(NOW + 11 * DAY_MS, NOW, 'zh-TW')).toContain('天');
    expect(formatRelativeInstant(NOW + 11 * DAY_MS, NOW, 'ru')).toBeTruthy();
  });

  test('distinguishes past from future', () => {
    const future = formatRelativeInstant(NOW + 3 * DAY_MS, NOW, 'en');
    const past = formatRelativeInstant(NOW - 3 * DAY_MS, NOW, 'en');
    expect(future).not.toBe(past);
    expect(past).toContain('ago');
  });

  test('falls back instead of throwing on an unusable locale tag', () => {
    expect(() => formatRelativeInstant(NOW + DAY_MS, NOW, 'not-a-locale!!')).not.toThrow();
    expect(formatRelativeInstant(NOW + DAY_MS, NOW, 'not-a-locale!!')).toBeTruthy();
  });
});

describe('formatInstantShort', () => {
  test('matches the shape the baked reset labels already use', () => {
    const iso = new Date(2026, 7, 13, 14, 30).toISOString();
    expect(formatInstantShort(new Date(iso).getTime())).toBe(formatQuotaResetTime(iso));
  });

  test('degrades to a dash rather than "Invalid Date"', () => {
    expect(formatInstantShort(Number.NaN)).toBe('-');
  });
});

describe('buildResetDisplay', () => {
  test('distinguishes multi-day reset times to the hour', () => {
    expect(buildResetDisplay(null, NOW + DAY_MS + 5 * HOUR_MS, NOW, 'en')?.relative).toBe('1d5h');
    expect(buildResetDisplay(null, NOW + DAY_MS + 20 * HOUR_MS, NOW, 'en')?.relative).toBe('1d20h');
  });

  test('shows the local weekday and time from the reset instant', () => {
    const at = new Date(2026, 7, 4, 14, 12).getTime();
    expect(buildResetDisplay('08-04 14:12', at, NOW, 'en')?.absolute).toMatch(/^Tue,? 2:12\sPM$/);
  });

  test('uses the current time zone when the date is formatted again', () => {
    // Keep changes to the runtime's default time zone out of the test runner.
    const run = Bun.spawnSync([
      process.execPath,
      '-e',
      `
        import { buildResetDisplay } from '@/utils/quota/relativeTime';
        const now = Date.parse('2026-11-25T09:00:00Z');
        const reset = Date.parse('2026-11-27T05:40:00Z');
        const displays = ['Europe/London', 'America/Los_Angeles'].map((zone) => {
          process.env.TZ = zone;
          return buildResetDisplay(null, reset, now, 'en-US');
        });
        console.log(JSON.stringify(displays));
      `,
    ]);
    expect(run.exitCode).toBe(0);
    const [london, losAngeles] = JSON.parse(run.stdout.toString());
    expect(london.absolute).toMatch(/^Fri,? 5:40\sAM$/);
    expect(london.title).toContain('Friday, November 27');
    expect(losAngeles.absolute).toMatch(/^Thu,? 9:40\sPM$/);
    expect(losAngeles.title).toContain('Thursday, November 26');
  });

  test('preserves the full local date and the exact instant', () => {
    const at = new Date(2026, 7, 13, 14, 30);
    const display = buildResetDisplay(null, at.getTime(), NOW, 'en');
    expect(display?.dateTime).toBe(at.toISOString());
    expect(display?.title).toContain('Thursday, August 13, 2026');
    expect(display?.relative).toBe('11d2h');
  });

  test('keeps the baked label alone when the instant is missing', () => {
    // A store entry cached by an older build carries resetLabel but no resetAtMs.
    expect(buildResetDisplay('08-13 14:30', null, NOW, 'en')).toEqual({
      absolute: '08-13 14:30',
      relative: null,
    });
    expect(buildResetDisplay('08-13 14:30', undefined, NOW, 'en')?.relative).toBeNull();
  });

  test('shows hours and minutes for resets within a day', () => {
    expect(buildResetDisplay(null, NOW + 90 * MINUTE_MS, NOW, 'en')?.relative).toBe('1h30m');
    expect(buildResetDisplay(null, NOW + HOUR_MS - 1, NOW, 'en')?.relative).toBe('59m');
    expect(buildResetDisplay(null, NOW + 1, NOW, 'en')?.relative).toBe('<1m');
  });

  test('stops showing a countdown when a reset is reached', () => {
    expect(buildResetDisplay(null, NOW, NOW, 'en')?.relative).toBeNull();
    expect(buildResetDisplay(null, NOW - HOUR_MS, NOW, 'en')?.relative).toBe('1 hour ago');
  });

  test('returns null when there is nothing to render', () => {
    expect(buildResetDisplay(undefined, null, NOW, 'en')).toBeNull();
    expect(buildResetDisplay('', null, NOW, 'en')).toBeNull();
    expect(buildResetDisplay('   ', null, NOW, 'en')).toBeNull();
    // '-' is the providers' own placeholder for "no reset known".
    expect(buildResetDisplay('-', null, NOW, 'en')).toBeNull();
  });

  test('treats a placeholder label with a real instant as renderable', () => {
    const display = buildResetDisplay('-', NOW + DAY_MS, NOW, 'en');
    expect(display?.absolute).toMatch(/^Mon,? 12:00\sPM$/);
    expect(display?.relative).toBe('1d0h');
  });

  test('rejects a non-finite instant', () => {
    expect(buildResetDisplay(undefined, Number.NaN, NOW, 'en')).toBeNull();
    expect(
      buildResetDisplay('08-13 14:30', Number.POSITIVE_INFINITY, NOW, 'en')?.relative
    ).toBeNull();
  });

  test('falls back to a usable format for an invalid locale', () => {
    expect(buildResetDisplay(null, NOW + DAY_MS, NOW, 'invalid!!')?.relative).toBeTruthy();
  });
});
