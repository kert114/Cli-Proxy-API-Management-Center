import { expect, test } from 'bun:test';
import { groupPullRequests } from '../src/features/dashboard/workspace/pulls';
import type { DashboardPullRequest } from '../src/services/api/githubDashboard';
const pr = (repository: string, number: number, updatedAt: string): DashboardPullRequest => ({
  repository,
  number,
  updatedAt,
  createdAt: '2026-01-01T00:00:00Z',
  title: 'Example',
  url: `https://github.com/${repository}/pull/${number}`,
  author: 'kert114',
  draft: false,
  review: '',
  checks: '',
  mergeable: 'UNKNOWN',
  state: 'OPEN',
});
const rows = [
  pr('60xAI/old', 1, '2026-01-03T00:00:00Z'),
  pr('60xAI/new', 2, '2026-01-05T00:00:00Z'),
  pr('60xAI/new', 3, '2026-01-06T00:00:00Z'),
];
test('orders repositories and their PRs by latest update', () => {
  expect(
    groupPullRequests(rows, { filter: 'all', repository: '', search: '' }).map((group) => [
      group.repository,
      group.pullRequests.map((pr) => pr.number),
    ])
  ).toEqual([
    ['60xAI/new', [3, 2]],
    ['60xAI/old', [1]],
  ]);
});

import { matchesPullFilter } from '../src/features/dashboard/workspace/pulls';
test('filters lifecycle independently of review/checks and never treats unknown as a conflict', () => {
  const unknown = rows[0];
  expect(matchesPullFilter(unknown, 'conflicts')).toBe(false);
  expect(matchesPullFilter(unknown, 'attention')).toBe(false);
  expect(
    matchesPullFilter(
      { ...unknown, state: 'MERGED', checks: 'FAILURE', mergeable: 'CONFLICTING' },
      'merged'
    )
  ).toBe(true);
  expect(matchesPullFilter({ ...unknown, state: 'MERGED', checks: 'FAILURE' }, 'attention')).toBe(
    false
  );
  expect(
    groupPullRequests(rows, {
      filter: 'all',
      repository: '60xAI/new',
      search: '#2',
    })[0].pullRequests.map((pr) => pr.number)
  ).toEqual([2]);
});
