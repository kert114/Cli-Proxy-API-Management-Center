import { apiClient } from './client';

export interface GitHubPullRequest {
  repository: string;
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
  updatedAt?: string;
}

export interface GitHubCommit {
  repository: string;
  sha: string;
  title: string;
  url: string;
  date: string;
  author: string;
}

export interface GitHubIssue {
  repository: string;
  number: number;
  title: string;
  url: string;
  state: string;
  createdAt: string;
}
export interface GitHubReview {
  repository: string;
  title: string;
  url: string;
  date: string;
}
export interface GitHubRepository {
  name: string;
  url: string;
  defaultBranch: string;
  fork: boolean;
  commitCount: number;
}
export interface GitHubActivity {
  scope:
    | { kind: 'account'; login: string }
    | { kind: 'organization'; name: string; account: string }
    | { kind: 'repository'; name: string };
  repositoryCount: number;
  issueCount: number;
  reviewCount: number;
  openTruncated: boolean;
  repositories: GitHubRepository[];
  issues: GitHubIssue[];
  reviews: GitHubReview[];
  repository: string;
  url: string;
  defaultBranch: string;
  checkedAt: string;
  cacheStatus?: 'fresh' | 'refreshed' | 'stale';
  refreshError?: boolean;
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

const repositoryPattern = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/;
function repositoryName(value: unknown): string {
  const name = text(value);
  if (!repositoryPattern.test(name)) throw new Error('Invalid GitHub repository');
  return name;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid GitHub activity response');
  return value;
}
export function parseGitHubActivity(
  payload: unknown,
  expected?: { account: string; organization: string }
): GitHubActivity {
  const data = record(payload);
  const account = data.account === undefined ? '' : text(data.account);
  if (account && !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(account)) {
    throw new Error('Invalid GitHub account');
  }
  const organization = data.organization === undefined ? '' : text(data.organization);
  if (organization && (!account || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(organization)))
    throw new Error('Invalid GitHub organization');
  if (
    expected &&
    (account.toLowerCase() !== expected.account.toLowerCase() ||
      organization.toLowerCase() !== expected.organization.toLowerCase())
  )
    throw new Error('Unexpected GitHub activity scope');
  const scopedRepository = (value: unknown) => {
    const name = repositoryName(value);
    if (organization && name.split('/')[0].toLowerCase() !== organization.toLowerCase())
      throw new Error('Repository outside GitHub organization');
    return name;
  };
  const repository = account ? '' : scopedRepository(data.repository);
  const rowRepository = (row: Record<string, unknown>) =>
    account ? scopedRepository(row.repository) : repository;
  const parsePR = (value: unknown): GitHubPullRequest => {
    const pr = record(value);
    const repo = rowRepository(pr);
    return {
      repository: repo,
      number: count(pr.number),
      title: text(pr.title),
      url: githubUrl(pr.url, repo),
      author: text(pr.author),
      draft: boolean(pr.draft),
      review: text(pr.review),
      checks: text(pr.checks),
      mergeable: text(pr.mergeable),
      state: text(pr.state),
      createdAt: text(pr.created_at),
      updatedAt:
        pr.updated_at === undefined || pr.updated_at === null ? undefined : text(pr.updated_at),
    };
  };
  return {
    scope: organization
      ? { kind: 'organization', name: organization, account }
      : account
        ? { kind: 'account', login: account }
        : { kind: 'repository', name: repository },
    repositoryCount: account ? count(data.repository_count) : 1,
    issueCount: account ? count(data.issue_count) : 0,
    reviewCount: account ? count(data.review_count) : 0,
    openTruncated: account ? boolean(data.open_truncated) : false,
    repositories: account
      ? list(data.repositories, (value) => {
          const repo = record(value);
          const name = scopedRepository(repo.name);
          return {
            name,
            url: githubUrl(repo.url, name),
            defaultBranch: text(repo.default_branch),
            fork: boolean(repo.fork),
            commitCount: count(repo.commit_count),
          };
        })
      : [],
    issues: account
      ? list(data.issues, (value) => {
          const issue = record(value);
          const repo = scopedRepository(issue.repository);
          return {
            repository: repo,
            number: count(issue.number),
            title: text(issue.title),
            url: githubUrl(issue.url, repo),
            state: text(issue.state),
            createdAt: text(issue.created_at),
          };
        })
      : [],
    reviews: account
      ? list(data.reviews, (value) => {
          const review = record(value);
          const repo = scopedRepository(review.repository);
          return {
            repository: repo,
            title: text(review.title),
            url: githubUrl(review.url, repo),
            date: text(review.date),
          };
        })
      : [],
    repository,
    url: githubUrl(data.url, organization || account || repository),
    defaultBranch: text(data.default_branch),
    checkedAt: text(data.checked_at),
    cacheStatus:
      data.cache_status === 'fresh' ||
      data.cache_status === 'refreshed' ||
      data.cache_status === 'stale'
        ? data.cache_status
        : undefined,
    refreshError: data.refresh_error === undefined ? undefined : boolean(data.refresh_error),
    openCount: count(data.open_count),
    createdCount: count(data.created_count),
    mergedCount: count(data.merged_count),
    commitCount: count(data.commit_count),
    openPRs: list(data.open_prs, parsePR),
    createdPRs: list(data.created_prs, parsePR),
    commits: list(data.commits, (value) => {
      const commit = record(value);
      const repo = rowRepository(commit);
      return {
        repository: repo,
        sha: text(commit.sha),
        title: text(commit.title),
        url: githubUrl(commit.url, repo),
        date: text(commit.date),
        author: text(commit.author),
      };
    }),
  };
}

export const githubActivityApi = {
  async getOrganization(
    account: string,
    organization: string,
    window: { since: string; until: string },
    signal?: AbortSignal,
    refresh = false
  ) {
    return parseGitHubActivity(
      await apiClient.get<unknown>('/observability/github', {
        params: { account, organization, ...window, ...(refresh ? { refresh: 1 } : {}) },
        signal,
        timeout: 0,
      }),
      { account, organization }
    );
  },
};

/** Reuses the API boundary parser when restoring persisted snapshots. */
export function gitHubActivityPayload(data: GitHubActivity) {
  const pr = (row: GitHubPullRequest) => ({
    ...row,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  });
  return {
    account:
      data.scope.kind === 'organization'
        ? data.scope.account
        : data.scope.kind === 'account'
          ? data.scope.login
          : undefined,
    organization: data.scope.kind === 'organization' ? data.scope.name : undefined,
    repository: data.repository,
    url: data.url,
    default_branch: data.defaultBranch,
    checked_at: data.checkedAt,
    cache_status: data.cacheStatus,
    refresh_error: data.refreshError,
    repository_count: data.repositoryCount,
    issue_count: data.issueCount,
    review_count: data.reviewCount,
    open_truncated: data.openTruncated,
    open_count: data.openCount,
    created_count: data.createdCount,
    merged_count: data.mergedCount,
    commit_count: data.commitCount,
    repositories: data.repositories.map((row) => ({
      ...row,
      default_branch: row.defaultBranch,
      commit_count: row.commitCount,
    })),
    issues: data.issues.map((row) => ({ ...row, created_at: row.createdAt })),
    reviews: data.reviews,
    open_prs: data.openPRs.map(pr),
    created_prs: data.createdPRs.map(pr),
    commits: data.commits,
  };
}
