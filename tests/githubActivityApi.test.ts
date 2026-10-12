import { expect, test } from 'bun:test';
import { parseGitHubActivity } from '../src/services/api/githubActivity';

const payload = {
  repository: 'local/fork',
  url: 'https://github.com/local/fork',
  default_branch: 'main',
  checked_at: '2026-10-12T12:00:00Z',
  open_count: 1,
  created_count: 1,
  merged_count: 0,
  commit_count: 2,
  open_prs: [
    {
      number: 7,
      title: 'Dashboard',
      url: 'https://github.com/local/fork/pull/7',
      author: 'person',
      draft: false,
      review: 'APPROVED',
      checks: 'SUCCESS',
      mergeable: 'MERGEABLE',
      state: '',
      created_at: '',
    },
  ],
  created_prs: [],
  commits: [
    {
      sha: 'abc123',
      title: 'Add dashboard',
      url: 'https://github.com/local/fork/commit/abc123',
      date: '2026-10-12T10:00:00Z',
      author: 'Person',
    },
  ],
};

test('normalizes GitHub snapshots into linked PR and commit activity', () => {
  const snapshot = parseGitHubActivity(payload);
  expect(snapshot.openPRs[0].url).toBe('https://github.com/local/fork/pull/7');
  expect(snapshot.commitCount).toBe(2);
  expect(snapshot.commits[0].title).toBe('Add dashboard');
});

test('rejects links outside the requested GitHub repository', () => {
  for (const url of [
    'javascript:alert(1)',
    'https://github.com/other/fork/pull/7',
    'https://github.com/local/fork-evil/pull/7',
  ]) {
    expect(() =>
      parseGitHubActivity({ ...payload, open_prs: [{ ...payload.open_prs[0], url }] })
    ).toThrow();
  }
  expect(() => parseGitHubActivity({ ...payload, commit_count: -1 })).toThrow();
});

const accountPayload = {
  ...payload,
  account: 'kert114',
  repository: '',
  url: 'https://github.com/kert114',
  repository_count: 2,
  issue_count: 1,
  review_count: 2,
  open_truncated: false,
  repositories: [
    {
      name: 'team/app',
      url: 'https://github.com/team/app',
      default_branch: 'main',
      fork: false,
      commit_count: 2,
    },
  ],
  issues: [
    {
      repository: 'team/app',
      number: 4,
      title: 'Track work',
      url: 'https://github.com/team/app/issues/4',
      state: 'OPEN',
      created_at: payload.checked_at,
    },
  ],
  reviews: [],
  open_prs: [
    { ...payload.open_prs[0], repository: 'team/app', url: 'https://github.com/team/app/pull/7' },
  ],
  commits: [
    {
      ...payload.commits[0],
      repository: 'kert114/fork',
      url: 'https://github.com/kert114/fork/commit/abc123',
    },
  ],
};

test('account activity accepts multiple repositories and keeps their identities', () => {
  const snapshot = parseGitHubActivity(accountPayload);
  expect(snapshot.scope.kind).toBe('account');
  expect(snapshot.openPRs[0].repository).toBe('team/app');
  expect(snapshot.commits[0].repository).toBe('kert114/fork');
  expect(snapshot.repositoryCount).toBe(2);
});
