import { expect, test } from 'bun:test';
import { parseCursorUsage } from '@/services/api/cursorUsage';
import { cursorUsageApi } from '@/services/api/cursorUsage';
import { apiClient } from '@/services/api/client';

test('preserves explicit zero usage and leaves missing measurements unknown', () => {
  expect(
    parseCursorUsage({
      plan: 'Teams',
      checked_at: '2026-10-08T12:00:00Z',
      included: { percent_used: 0 },
      access_token: 'discard-me',
      email: 'discard-me',
    })
  ).toEqual({
    plan: 'Teams',
    checkedAt: '2026-10-08T12:00:00Z',
    resetsAt: null,
    included: { percentUsed: 0, autoPercentUsed: null, apiPercentUsed: null },
    onDemand: null,
    partial: false,
  });
});

test('reads the authenticated v8 monitoring endpoint without creating a credential', async () => {
  const requests: { path: string; authorization: string | null; method: string }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get('Authorization'),
        method: request.method,
      });
      return Response.json({ checked_at: '2026-10-08T12:00:00Z', included: {} });
    },
  });
  try {
    apiClient.setConfig({ apiBase: server.url.toString(), managementKey: 'fixture-key' });
    const snapshot = await cursorUsageApi.get();
    expect(snapshot.included.percentUsed).toBeNull();
    expect(requests).toEqual([
      {
        path: '/v8/management/observability/usage/cursor',
        authorization: 'Bearer fixture-key',
        method: 'GET',
      },
    ]);
  } finally {
    apiClient.setConfig({ apiBase: '', managementKey: '' });
    server.stop(true);
  }
});

test('rejects malformed snapshots and never treats invalid numbers as zero', () => {
  for (const value of [null, [], {}, { checked_at: 'bad', included: {} }]) {
    expect(() => parseCursorUsage(value)).toThrow('Invalid Cursor usage response');
  }
  const snapshot = parseCursorUsage({
    checked_at: '2026-10-08T12:00:00Z',
    resets_at: 'bad',
    included: { percent_used: -1, auto_percent_used: '0', api_percent_used: NaN },
    on_demand: { used_usd: Infinity, limit_kind: 'unlimited' },
    warnings: ['Do not display raw upstream text'],
  });
  expect(snapshot.included).toEqual({
    percentUsed: null,
    autoPercentUsed: null,
    apiPercentUsed: null,
  });
  expect(snapshot.onDemand).toBeNull();
  expect(snapshot.resetsAt).toBeNull();
  expect(snapshot.partial).toBe(true);
});

test('recognizes the backend login-required code without displaying its raw error text', async () => {
  const server = Bun.serve({
    port: 0,
    fetch() {
      return Response.json(
        { code: 'cursor_login_required', error: 'raw upstream text' },
        { status: 503 }
      );
    },
  });
  try {
    apiClient.setConfig({ apiBase: server.url.toString(), managementKey: 'fixture-key' });
    await expect(cursorUsageApi.get()).rejects.toMatchObject({
      reason: 'login',
      message: 'Cursor usage is unavailable',
    });
  } finally {
    apiClient.setConfig({ apiBase: '', managementKey: '' });
    server.stop(true);
  }
});

test('keeps personal on-demand dollars and distinguishes fixed, disabled and unlimited limits', () => {
  const payload = {
    plan: 'Teams',
    checked_at: '2026-10-08T12:00:00Z',
    included: {},
    on_demand: { used_usd: 12.34, limit_usd: 50, limit_kind: 'fixed' },
  };
  expect(parseCursorUsage(payload).onDemand).toEqual({
    usedUsd: 12.34,
    limit: { kind: 'fixed', usd: 50 },
  });
  for (const kind of ['disabled', 'unlimited', 'unavailable']) {
    expect(
      parseCursorUsage({
        ...payload,
        on_demand: { used_usd: 0, limit_kind: kind },
      }).onDemand
    ).toEqual({ usedUsd: 0, limit: { kind } });
  }
  expect(
    parseCursorUsage({
      ...payload,
      on_demand: { used_usd: 12.34, limit_kind: 'fixed' },
    }).onDemand
  ).toEqual({ usedUsd: 12.34, limit: { kind: 'unavailable' } });
});
