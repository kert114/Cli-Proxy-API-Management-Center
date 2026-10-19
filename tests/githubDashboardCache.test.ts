import { expect, test } from 'bun:test';
import { DashboardCache } from '../src/features/dashboard/workspace/cache';

test('reuses a fetched year across month changes without another history request', async () => {
  const cache = new DashboardCache<string>();
  await cache.load('connection:2025', 30 * 86400000, async () => 'saved year');
  expect(await cache.load('connection:2025', 30 * 86400000, async () => 'unwanted refetch')).toBe(
    'saved year'
  );
});

test('cancels an old connection and cannot cache its late response', async () => {
  const cache = new DashboardCache<string>();
  let finish: (value: string) => void = () => {};
  let signal: AbortSignal | undefined;
  const pending = cache.load('old', 60000, (requestSignal) => {
    signal = requestSignal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  cache.invalidate();
  expect(signal?.aborted).toBe(true);
  finish('private old account');
  await expect(pending).rejects.toThrow('session changed');
  expect(cache.read('old')).toBeUndefined();
});

test('deduplicates requests, keeps stale data on failure and enforces the manual minimum', async () => {
  let now = 1000;
  const cache = new DashboardCache<string>(() => now);
  let finish: (value: string) => void = () => {};
  const first = cache.load(
    'pulls',
    60000,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const second = cache.load('pulls', 60000, async () => 'duplicate');
  expect(first).toBe(second);
  finish('old PRs');
  await first;
  expect(await cache.load('pulls', 60000, async () => 'too soon', true)).toBe('old PRs');
  now = 17000;
  await expect(
    cache.load(
      'pulls',
      60000,
      async () => {
        throw new Error('offline');
      },
      true
    )
  ).rejects.toThrow('offline');
  expect(cache.read('pulls')).toBe('old PRs');
  expect(await cache.load('new-connection:pulls', 60000, async () => 'new PRs')).toBe('new PRs');
});
