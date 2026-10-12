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
