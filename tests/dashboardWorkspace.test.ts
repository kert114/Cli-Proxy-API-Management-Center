import { expect, test } from 'bun:test';
import {
  activityBuckets,
  listedCount,
  selectPullRequests,
} from '../src/features/dashboard/activity/workspace';
import type { GitHubPullRequest } from '../src/services/api/githubActivity';
const pr = (number: number, overrides: Partial<GitHubPullRequest> = {}): GitHubPullRequest => ({
  repository: '60xAI/app',
  number,
  title: `Work ${number}`,
  url: `https://github.com/60xAI/app/pull/${number}`,
  author: 'kert114',
  draft: false,
  review: 'APPROVED',
  checks: 'SUCCESS',
  mergeable: 'MERGEABLE',
  state: 'OPEN',
  createdAt: '2026-10-12T10:00:00Z',
  ...overrides,
});

test('attention queue finds failures and conflicts, while green drafts remain drafts', () => {
  const rows = [
    pr(1),
    pr(2, { draft: true }),
    pr(3, { checks: 'FAILURE' }),
    pr(4, { mergeable: 'CONFLICTING' }),
  ];
  expect(
    selectPullRequests(rows, {
      search: '',
      repository: '',
      filter: 'attention',
      sort: 'attention',
      account: 'kert114',
    }).map((row) => row.number)
  ).toEqual([3, 4]);
});

test('search, repository and draft scope combine with newest-created sorting', () => {
  const rows = [
    pr(1, { draft: true, title: 'Cache fix' }),
    pr(2, { draft: true, title: 'Cache fix', createdAt: '2026-10-13T10:00:00Z' }),
    pr(3, { draft: true, repository: '60xAI/tools', title: 'Cache fix' }),
    pr(4, { title: 'Cache fix' }),
  ];
  expect(
    selectPullRequests(rows, {
      search: 'cache',
      repository: '60xAI/app',
      filter: 'draft',
      sort: 'newest',
      account: 'kert114',
    }).map((row) => row.number)
  ).toEqual([2, 1]);
});

test('calendar chart buckets count only listed dated events and never imply zero coverage', () => {
  const { since, until } = {
    since: new Date(2026, 9, 12).toISOString(),
    until: new Date(2026, 9, 19).toISOString(),
  };
  const buckets = activityBuckets({ since, until }, 'week', new Date(2026, 9, 19, 12));
  const events = [
    {
      repository: '60xAI/app',
      title: 'Fix',
      url: 'https://github.com/60xAI/app/commit/abc',
      date: new Date(2026, 9, 12, 12).toISOString(),
    },
    {
      repository: '60xAI/tools',
      title: 'Docs',
      url: 'https://github.com/60xAI/tools/commit/def',
      date: new Date(2026, 9, 12, 15).toISOString(),
    },
    {
      repository: '60xAI/app',
      title: 'Unknown date',
      url: 'https://github.com/60xAI/app/commit/ghi',
      date: '',
    },
  ];
  expect(buckets.length).toBe(7);
  expect(listedCount(events, buckets[0])).toBe(2);
  expect(listedCount(events, buckets[0], '60xAI/app')).toBe(1);
  expect(listedCount(events, buckets[1])).toBeNull();
});

test('day charts stop at the current hour instead of showing future hours', () => {
  const now = new Date(2026, 9, 13, 10, 30);
  const buckets = activityBuckets(
    {
      since: new Date(2026, 9, 13).toISOString(),
      until: new Date(2026, 9, 14).toISOString(),
    },
    'day',
    now
  );
  expect(buckets).toHaveLength(11);
  expect(buckets[10]).toEqual({
    since: new Date(2026, 9, 13, 10).getTime(),
    until: now.getTime(),
  });
});

test('draft, review, newest and repository sorts preserve their declared meaning', () => {
  const rows = [
    pr(1, { repository: '60xAI/z', draft: true }),
    pr(2, { repository: '60xAI/a', review: 'REVIEW_REQUIRED' }),
    pr(3, { createdAt: '2026-10-13T10:00:00Z' }),
  ];
  const options = { search: '', repository: '', filter: 'all' as const, account: 'kert114' };
  expect(selectPullRequests(rows, { ...options, sort: 'draft' }).map((row) => row.number)).toEqual([
    1, 3, 2,
  ]);
  expect(selectPullRequests(rows, { ...options, sort: 'review' }).map((row) => row.number)).toEqual(
    [2, 3, 1]
  );
  expect(selectPullRequests(rows, { ...options, sort: 'newest' }).map((row) => row.number)).toEqual(
    [3, 1, 2]
  );
  expect(
    selectPullRequests(rows, { ...options, sort: 'repository' }).map((row) => row.number)
  ).toEqual([2, 3, 1]);
  expect(rows.map((row) => row.number)).toEqual([1, 2, 3]);
});
