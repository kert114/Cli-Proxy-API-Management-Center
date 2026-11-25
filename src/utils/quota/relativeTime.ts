import { DAY_MS, HOUR_MS, MINUTE_MS } from '@/utils/time/durations';

export interface RelativeTimeParts {
  /** Signed magnitude: positive is future, negative is past. */
  value: number;
  unit: 'day' | 'hour' | 'minute';
}

/**
 * Coarsest unit that still describes the gap, with a signed magnitude.
 *
 * Signed on purpose: the earlier timeline-local version clamped with
 * `Math.max(0, …)`, so a credit that expired last week read "in 1 minute" —
 * technically monotonic, actively misleading.
 *
 * Truncated, not rounded up, for two reasons. It is the ordinary countdown
 * convention ("2 hours left" holds from 2:59 down to 2:00), and rounding up
 * crosses the unit thresholds: `DAY_MS - 1` picks the hour unit and then
 * ceils to "24 hours", `HOUR_MS - 1` to "60 minutes". For a deadline it also
 * errs in the safe direction — never claiming more time than remains.
 *
 * Sub-minute gaps floor to a magnitude of 1 so nothing renders "in 0 minutes".
 */
export function relativeTimeParts(targetMs: number, nowMs: number): RelativeTimeParts {
  const delta = targetMs - nowMs;
  const sign = delta < 0 ? -1 : 1;
  const abs = Math.abs(delta);

  if (abs >= DAY_MS) return { value: sign * Math.floor(abs / DAY_MS), unit: 'day' };
  if (abs >= HOUR_MS) return { value: sign * Math.floor(abs / HOUR_MS), unit: 'hour' };
  return { value: sign * Math.max(1, Math.floor(abs / MINUTE_MS)), unit: 'minute' };
}

/**
 * Formatters are cached per locale: this runs once per quota row per minute,
 * and constructing an Intl formatter is the expensive part.
 */
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function getRelativeFormatter(locale?: string): Intl.RelativeTimeFormat {
  const key = locale ?? '';
  const cached = relativeFormatters.get(key);
  if (cached) return cached;

  let formatter: Intl.RelativeTimeFormat;
  try {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
  } catch {
    // An unexpected `resolvedLanguage` throws RangeError rather than falling
    // back on its own. A countdown in the wrong language beats no card at all.
    formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' });
  }
  relativeFormatters.set(key, formatter);
  return formatter;
}

/** Localized relative phrase, e.g. `in 11 days` / `11 天后` / `11 days ago`. */
export function formatRelativeInstant(targetMs: number, nowMs: number, locale?: string): string {
  const { value, unit } = relativeTimeParts(targetMs, nowMs);
  return getRelativeFormatter(locale).format(value, unit);
}

/**
 * Absolute instant in the shape every quota row already uses (`MM-DD HH:mm`,
 * browser-local, 24-hour). Kept in one place so the reset labels baked at fetch
 * time and the ones formatted at render time can never drift apart.
 */
export function formatInstantShort(ms: number): string {
  if (!Number.isFinite(ms)) return '-';
  return new Date(ms).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export interface ResetDisplay {
  absolute: string;
  relative: string | null;
  dateTime?: string;
  title?: string;
}

function createResetFormatters(timeZone: string, locale?: string) {
  const unit = (name: 'day' | 'hour' | 'minute') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' });
  return {
    day: unit('day'),
    hour: unit('hour'),
    minute: unit('minute'),
    short: new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }),
    full: new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'full', timeStyle: 'short' }),
  };
}

const resetFormatters = new Map<string, ReturnType<typeof createResetFormatters>>();

function getResetFormatters(locale?: string) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const key = `${timeZone}:${locale ?? ''}`;
  const cached = resetFormatters.get(key);
  if (cached) return cached;

  let formatters;
  try {
    formatters = createResetFormatters(timeZone, locale);
  } catch {
    formatters = createResetFormatters(timeZone);
  }
  resetFormatters.set(key, formatters);
  return formatters;
}

function formatResetCountdown(deltaMs: number, format: ReturnType<typeof createResetFormatters>) {
  const days = Math.floor(deltaMs / DAY_MS);
  const hours = Math.floor((deltaMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((deltaMs % HOUR_MS) / MINUTE_MS);

  if (days > 0) return format.day.format(days) + format.hour.format(hours);
  if (hours > 0) return format.hour.format(hours) + (minutes ? format.minute.format(minutes) : '');
  if (minutes > 0) return format.minute.format(minutes);
  return '<' + format.minute.format(1);
}

/**
 * Show a local weekday and time beside the live countdown. Older cached
 * entries and providers without an instant can still supply a display label.
 */
export function buildResetDisplay(
  absoluteLabel: string | undefined | null,
  atMs: number | undefined | null,
  nowMs: number,
  locale?: string
): ResetDisplay | null {
  const trimmed = typeof absoluteLabel === 'string' ? absoluteLabel.trim() : '';
  const date = new Date(atMs ?? NaN);
  const resetMs = date.getTime();
  if (!Number.isFinite(resetMs)) {
    return trimmed && trimmed !== '-' ? { absolute: trimmed, relative: null } : null;
  }

  const format = getResetFormatters(locale);
  const deltaMs = resetMs - nowMs;
  let relative = null;
  if (deltaMs > 0) relative = formatResetCountdown(deltaMs, format);
  if (deltaMs < 0) relative = formatRelativeInstant(resetMs, nowMs, locale);
  return {
    absolute: format.short.format(date),
    relative,
    dateTime: date.toISOString(),
    title: format.full.format(date),
  };
}
