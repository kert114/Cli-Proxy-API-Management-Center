import { beforeAll, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { CursorUsageBody } from '@/features/quota/cursor/CursorUsageBody';
import type { CursorUsageSnapshot } from '@/services/api/cursorUsage';
import { bindQuotaClasses, QUOTA_CLASS_KEYS } from '@/features/quota/types';
import { formatInstantShort, formatRelativeInstant } from '@/utils/quota';

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test-host'
);
const resetMs = Date.now() + 10 * 86_400_000 + 12 * 3_600_000;
const snapshot: CursorUsageSnapshot = {
  plan: 'Pro',
  checkedAt: '2026-10-09T08:00:00Z',
  resetsAt: new Date(resetMs).toISOString(),
  included: { percentUsed: 25, autoPercentUsed: 10, apiPercentUsed: 15 },
  onDemand: { usedUsd: 12.34, limit: { kind: 'fixed', usd: 50 } },
  partial: false,
};

const render = (value: CursorUsageSnapshot) =>
  renderToStaticMarkup(createElement(CursorUsageBody, { snapshot: value, classes }));

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

test('shows the Cursor billing reset beside each limit in the shared quota format', () => {
  const markup = render(snapshot);
  const absolute = formatInstantShort(resetMs);
  const relative = formatRelativeInstant(resetMs, Date.now(), 'en');

  expect(markup.split(absolute).length - 1).toBe(3);
  expect(markup.split(relative).length - 1).toBe(3);
  expect(markup).not.toContain('Billing resets');
  expect(markup).not.toContain(new Date(resetMs).toLocaleString('en'));
});

test('leaves the reset off the rows when Cursor does not report one', () => {
  const markup = render({ ...snapshot, resetsAt: null });

  expect(markup).not.toContain('quotaReset');
  expect(markup).toContain('Included usage');
});
