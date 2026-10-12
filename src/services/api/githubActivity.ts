import { apiClient } from './client';

export interface GitHubPullRequest {
  number: number;
  title: string;
  url: string;
  author: string;
  draft: boolean;
  review: string;
  checks: string;
  mergeable: string;
  state: string;
  createdAt: string;
}

export interface GitHubCommit {
  sha: string;
  title: string;
  url: string;
  date: string;
  author: string;
}

export interface GitHubActivity {
  repository: string;
  url: string;
  defaultBranch: string;
  checkedAt: string;
  openCount: number;
  createdCount: number;
  mergedCount: number;
  commitCount: number;
  openPRs: GitHubPullRequest[];
  createdPRs: GitHubPullRequest[];
  commits: GitHubCommit[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid GitHub activity response');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid GitHub activity response');
  return value;
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid GitHub activity response');
  }
  return value;
}

function githubUrl(value: unknown, repository: string): string {
  const url = new URL(text(value));
  if (
    url.origin !== 'https://github.com' ||
    url.username ||
    url.password ||
    (url.pathname !== `/${repository}` && !url.pathname.startsWith(`/${repository}/`))
  )
    throw new Error('Invalid GitHub activity link');
  return url.href;
}

function list<T>(value: unknown, parse: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('Invalid GitHub activity response');
  return value.map(parse);
}

export function parseGitHubActivity(payload: unknown): GitHubActivity {
  const data = record(payload);
  const repository = text(data.repository);
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) {
    throw new Error('Invalid GitHub repository');
  }
  const parsePR = (value: unknown): GitHubPullRequest => {
    const pr = record(value);
    if (typeof pr.draft !== 'boolean') throw new Error('Invalid GitHub activity response');
    return {
      number: count(pr.number),
      title: text(pr.title),
      url: githubUrl(pr.url, repository),
      author: text(pr.author),
      draft: pr.draft,
      review: text(pr.review),
      checks: text(pr.checks),
      mergeable: text(pr.mergeable),
      state: text(pr.state),
      createdAt: text(pr.created_at),
    };
  };
  return {
    repository,
    url: githubUrl(data.url, repository),
    defaultBranch: text(data.default_branch),
    checkedAt: text(data.checked_at),
    openCount: count(data.open_count),
    createdCount: count(data.created_count),
    mergedCount: count(data.merged_count),
    commitCount: count(data.commit_count),
    openPRs: list(data.open_prs, parsePR),
    createdPRs: list(data.created_prs, parsePR),
    commits: list(data.commits, (value) => {
      const commit = record(value);
      return {
        sha: text(commit.sha),
        title: text(commit.title),
        url: githubUrl(commit.url, repository),
        date: text(commit.date),
        author: text(commit.author),
      };
    }),
  };
}

export const githubActivityApi = {
  async get(repository: string, window: { since: string; until: string }, signal?: AbortSignal) {
    return parseGitHubActivity(
      await apiClient.get<unknown>('/observability/github', {
        params: { repository, ...window },
        signal,
      })
    );
  },
};
