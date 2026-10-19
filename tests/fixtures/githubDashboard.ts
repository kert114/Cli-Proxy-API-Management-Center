/** Synthetic contract fixtures. Imported only by tests and explicit browser verification. */
export function statisticsFixture(year = new Date().getUTCFullYear()) {
  const start = Date.UTC(year, 0, 1);
  const end = Math.min(
    Date.UTC(year + 1, 0, 1) - 86400000,
    Date.parse(new Date().toISOString().slice(0, 10))
  );
  return {
    account: 'kert114',
    organization: '',
    checked_at: new Date().toISOString(),
    stale: false,
    year,
    days: Array.from({ length: Math.floor((end - start) / 86400000) + 1 }, (_, index) => ({
      date: new Date(start + index * 86400000).toISOString().slice(0, 10),
      contributions: index % 7 === 0 ? 0 : index % 7 === 1 ? 1 : index % 19,
    })),
  };
}
export function pullsFixture() {
  return {
    account: 'kert114',
    organization: '60xAI',
    checked_at: new Date().toISOString(),
    stale: false,
    truncated: false,
    pull_requests: [
      {
        repository: '60xAI/workspace-example',
        number: 42,
        title: 'Keep quota refresh independent of reset credits',
        url: 'https://github.com/60xAI/workspace-example/pull/42',
        author: 'kert114',
        draft: false,
        review: 'APPROVED',
        checks: 'SUCCESS',
        mergeable: 'UNKNOWN',
        state: 'OPEN',
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-19T12:00:00Z',
      },
      {
        repository: '60xAI/workspace-example',
        number: 41,
        title: 'Show daily contribution counts',
        url: 'https://github.com/60xAI/workspace-example/pull/41',
        author: 'qa-example',
        draft: false,
        review: 'APPROVED',
        checks: 'SUCCESS',
        mergeable: 'MERGEABLE',
        state: 'MERGED',
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-18T12:00:00Z',
      },
      {
        repository: '60xAI/provider-example',
        number: 18,
        title: 'Review provider status handling',
        url: 'https://github.com/60xAI/provider-example/pull/18',
        author: 'qa-example',
        draft: false,
        review: 'CHANGES_REQUESTED',
        checks: 'FAILURE',
        mergeable: 'CONFLICTING',
        state: 'OPEN',
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-19T11:00:00Z',
      },
      {
        repository: '60xAI/archive-example',
        number: 3,
        title: 'Close an obsolete proposal',
        url: 'https://github.com/60xAI/archive-example/pull/3',
        author: 'qa-example',
        draft: false,
        review: '',
        checks: '',
        mergeable: 'UNKNOWN',
        state: 'CLOSED',
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-17T12:00:00Z',
      },
    ],
  };
}
