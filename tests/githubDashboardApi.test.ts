import { expect, test } from 'bun:test';
import { parseGitHubStatistics } from '../src/services/api/githubDashboard';

const base = {
  account: 'kert114',
  organization: '60xAI',
  checked_at: '2026-01-02T12:00:00Z',
  stale: false,
};
const statistics = {
  ...base,
  year: 2026,
  days: [
    { date: '2026-01-01', contributions: 0 },
    { date: '2026-01-02', contributions: 1 },
  ],
};
test('reads exact daily contributions, including zero and one', () => {
  expect(parseGitHubStatistics(statistics, 2026).days).toEqual(statistics.days);
});

test('rejects another scope, requested year mismatch, missing days and future dates', () => {
  for (const value of [
    { ...statistics, account: 'someone-else' },
    { ...statistics, organization: 'other-org' },
    { ...statistics, year: 2025 },
    { ...statistics, days: [{ date: '2026-01-02', contributions: 1 }] },
    { ...statistics, days: [{ date: '2026-01-01', contributions: -1 }] },
    { ...statistics, days: [{ date: '2026-01-01', contributions: 1.2 }] },
  ])
    expect(() => parseGitHubStatistics(value, 2026)).toThrow();
});

import { parseGitHubPulls } from '../src/services/api/githubDashboard';
const pr = {
  repository: '60xAI/example',
  number: 12,
  title: 'A real title',
  url: 'https://github.com/60xAI/example/pull/12',
  author: 'kert114',
  draft: false,
  review: 'APPROVED',
  checks: 'SUCCESS',
  mergeable: 'UNKNOWN',
  state: 'MERGED',
  created_at: '2026-01-01T12:00:00Z',
  updated_at: '2026-01-02T12:00:00Z',
};
test('reads PR lifecycle separately from unknown mergeability', () => {
  expect(
    parseGitHubPulls({ ...base, pull_requests: [pr], truncated: false }).pullRequests[0]
  ).toMatchObject({ state: 'MERGED', mergeable: 'UNKNOWN', updatedAt: pr.updated_at });
});

test('rejects PR links outside the exact organization repository and PR number', () => {
  for (const patch of [
    { url: 'javascript:alert(1)' },
    { url: 'https://github.com/60xAI/example/issues/12' },
    { url: 'https://github.com/60xAI/example/pull/13' },
    { repository: 'other/example' },
    { state: 'unknown' },
    { checks: 'untrusted' },
  ]) {
    expect(() =>
      parseGitHubPulls({ ...base, pull_requests: [{ ...pr, ...patch }], truncated: false })
    ).toThrow();
  }
});

import { apiClient } from '../src/services/api/client';
import { githubDashboardApi } from '../src/services/api/githubDashboard';
test('requests statistics and PRs separately through the v8 client without heavy history parameters', async () => {
  const requests: URL[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      requests.push(url);
      return Response.json(
        url.searchParams.get('section') === 'statistics'
          ? statistics
          : { ...base, pull_requests: [pr], truncated: false }
      );
    },
  });
  try {
    apiClient.setConfig({
      apiBase: `http://127.0.0.1:${server.port}`,
      managementKey: 'synthetic-api-fixture',
    });
    const [stats, pulls] = await Promise.all([
      githubDashboardApi.statistics(2026, undefined, true),
      githubDashboardApi.pulls(),
    ]);
    expect(stats.days[1].contributions).toBe(1);
    expect(pulls.pullRequests[0].state).toBe('MERGED');
    expect(requests).toHaveLength(2);
    for (const url of requests) {
      expect(url.pathname).toBe('/v8/management/observability/github/dashboard');
      expect(url.searchParams.get('account')).toBe('kert114');
      expect(url.searchParams.get('organization')).toBe('60xAI');
      expect(url.searchParams.has('since')).toBe(false);
      expect(url.searchParams.has('until')).toBe(false);
    }
    expect(
      requests
        .find((url) => url.searchParams.get('section') === 'statistics')
        ?.searchParams.get('refresh')
    ).toBe('1');
    expect(
      requests.find((url) => url.searchParams.get('section') === 'pulls')?.searchParams.has('year')
    ).toBe(false);
  } finally {
    server.stop(true);
    apiClient.setConfig({ apiBase: '', managementKey: '' });
  }
});

test('marks limited contribution totals and defaults older payloads to complete scope', () => {
  expect(parseGitHubStatistics(statistics, 2026).limited).toBe(false);
  expect(parseGitHubStatistics({ ...statistics, limited: true }, 2026).limited).toBe(true);
  expect(() => parseGitHubStatistics({ ...statistics, limited: 'yes' }, 2026)).toThrow();
});
