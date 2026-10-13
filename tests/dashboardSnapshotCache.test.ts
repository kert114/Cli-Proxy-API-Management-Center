import { expect, test } from 'bun:test';
import { ActivitySnapshotCache } from '../src/features/dashboard/activity/snapshotCache';
import { parseGitHubActivity } from '../src/services/api/githubActivity';
const expected = { account: 'viewer', organization: 'team' };
const snapshot = parseGitHubActivity({
  account: 'viewer',
  organization: 'team',
  repository: '',
  url: 'https://github.com/team',
  default_branch: '',
  checked_at: '2026-10-13T10:00:00Z',
  repository_count: 0,
  issue_count: 0,
  review_count: 0,
  open_truncated: false,
  open_count: 0,
  created_count: 0,
  merged_count: 0,
  commit_count: 0,
  repositories: [],
  issues: [],
  reviews: [],
  open_prs: [],
  created_prs: [],
  commits: [],
});
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

test('last successful scoped snapshot survives reload and failed refresh', async () => {
  const disk = storage();
  const cache = new ActivitySnapshotCache(disk);
  await cache.refresh('session/week', expected, async () => snapshot);
  const reloaded = new ActivitySnapshotCache(disk);
  expect(reloaded.read('session/week', expected)?.checkedAt).toBe('2026-10-13T10:00:00Z');
  await expect(
    reloaded.refresh('session/week', expected, async () => {
      throw new Error('offline');
    })
  ).rejects.toThrow('offline');
  expect(reloaded.read('session/week', expected)?.checkedAt).toBe('2026-10-13T10:00:00Z');
  expect(reloaded.read('another-session/week', expected)).toBeUndefined();
});

test('concurrent readers share a request and invalidation prevents late writes', async () => {
  const disk = storage();
  const cache = new ActivitySnapshotCache(disk);
  let resolve!: (value: typeof snapshot) => void;
  let calls = 0;
  const load = () => {
    calls++;
    return new Promise<typeof snapshot>((done) => {
      resolve = done;
    });
  };
  const first = cache.refresh('session/week', expected, load);
  const second = cache.refresh('session/week', expected, load);
  expect(calls).toBe(1);
  cache.invalidate();
  resolve(snapshot);
  await expect(first).rejects.toThrow('session changed');
  await expect(second).rejects.toThrow('session changed');
  expect(new ActivitySnapshotCache(disk).read('session/week', expected)).toBeUndefined();
});

test('malformed, foreign and unavailable storage cannot expose a cached scope or break live data', async () => {
  const broken = {
    getItem: () => '{broken',
    setItem: () => {
      throw new Error('quota exceeded');
    },
    removeItem: () => {
      throw new Error('disabled');
    },
  };
  const cache = new ActivitySnapshotCache(broken);
  expect(cache.read('session/week', expected)).toBeUndefined();
  await cache.refresh('session/week', expected, async () => snapshot);
  expect(cache.read('session/week', expected)?.scope.kind).toBe('organization');
  expect(cache.read('session/week', { account: 'another', organization: 'team' })).toBeUndefined();
  cache.invalidate();
  expect(cache.read('session/week', expected)).toBeUndefined();
});
