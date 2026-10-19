import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';

export const ACCOUNT = 'kert114';
export const ORGANIZATION = '60xAI';
export type ContributionDay = { date: string; contributions: number };
export type DashboardSnapshot = {
  account: string;
  organization: string;
  checkedAt: string;
  stale: boolean;
};
export type GitHubStatistics = DashboardSnapshot & {
  year: number;
  limited: boolean;
  days: ContributionDay[];
};
export type DashboardPullRequest = {
  repository: string;
  number: number;
  title: string;
  url: string;
  author: string;
  draft: boolean;
  review: string;
  checks: string;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  createdAt: string;
  updatedAt: string;
};
export type GitHubPulls = DashboardSnapshot & {
  pullRequests: DashboardPullRequest[];
  truncated: boolean;
};
function invalid(): never {
  throw new Error('Invalid GitHub dashboard response');
}
function string(value: unknown): string {
  return typeof value === 'string' ? value : invalid();
}
function boolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalid();
}
function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid();
}
function timestamp(value: unknown): string {
  const text = string(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text) || !Number.isFinite(Date.parse(text))) invalid();
  return text;
}
function base(payload: unknown) {
  if (!isRecord(payload) || payload.account !== ACCOUNT || payload.organization !== ORGANIZATION)
    invalid();
  return {
    raw: payload,
    account: ACCOUNT,
    organization: ORGANIZATION,
    checkedAt: timestamp(payload.checked_at),
    stale: boolean(payload.stale),
  };
}
export function parseGitHubStatistics(payload: unknown, year: number): GitHubStatistics {
  const { raw, ...snapshot } = base(payload);
  if (
    raw.year !== year ||
    !Number.isInteger(year) ||
    year < 2008 ||
    year > new Date().getUTCFullYear() ||
    !Array.isArray(raw.days)
  )
    invalid();
  const today = new Date().toISOString().slice(0, 10);
  let next = `${year}-01-01`;
  const days = raw.days.map((value): ContributionDay => {
    if (!isRecord(value)) invalid();
    const date = string(value.date);
    if (date !== next || date > today || !date.startsWith(`${year}-`)) invalid();
    next = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    return { date, contributions: count(value.contributions) };
  });
  return {
    ...snapshot,
    year,
    limited: raw.limited === undefined ? false : boolean(raw.limited),
    days,
  };
}
export function parseGitHubPulls(payload: unknown): GitHubPulls {
  const { raw, ...snapshot } = base(payload);
  if (!Array.isArray(raw.pull_requests)) invalid();
  const seen = new Set<string>();
  const pullRequests = raw.pull_requests.map((value): DashboardPullRequest => {
    if (!isRecord(value)) invalid();
    const repository = string(value.repository);
    if (
      !/^60xAI\/[A-Za-z0-9_.-]{1,100}$/.test(repository) ||
      ['.', '..'].includes(repository.split('/')[1])
    )
      invalid();
    const number = count(value.number);
    if (number === 0) invalid();
    const url = string(value.url);
    if (url !== `https://github.com/${repository}/pull/${number}` || seen.has(url)) invalid();
    seen.add(url);
    const state = value.state;
    const mergeable = value.mergeable;
    if (state !== 'OPEN' && state !== 'CLOSED' && state !== 'MERGED') invalid();
    if (mergeable !== 'MERGEABLE' && mergeable !== 'CONFLICTING' && mergeable !== 'UNKNOWN')
      invalid();
    const checks = string(value.checks);
    const review = string(value.review);
    if (
      !['SUCCESS', 'FAILURE', 'ERROR', 'PENDING', 'EXPECTED', ''].includes(checks) ||
      !['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED', ''].includes(review)
    )
      invalid();
    return {
      repository,
      number,
      url,
      state,
      mergeable,
      checks,
      review,
      title: string(value.title),
      author: string(value.author),
      draft: boolean(value.draft),
      createdAt: timestamp(value.created_at),
      updatedAt: timestamp(value.updated_at),
    };
  });
  return { ...snapshot, pullRequests, truncated: boolean(raw.truncated) };
}

const endpoint = '/observability/github/dashboard';
export const githubDashboardApi = {
  async statistics(year: number, signal?: AbortSignal, refresh = false) {
    return parseGitHubStatistics(
      await apiClient.get<unknown>(endpoint, {
        params: {
          account: ACCOUNT,
          organization: ORGANIZATION,
          section: 'statistics',
          year,
          ...(refresh ? { refresh: 1 } : {}),
        },
        signal,
        timeout: 0,
      }),
      year
    );
  },
  async pulls(signal?: AbortSignal, refresh = false) {
    return parseGitHubPulls(
      await apiClient.get<unknown>(endpoint, {
        params: {
          account: ACCOUNT,
          organization: ORGANIZATION,
          section: 'pulls',
          ...(refresh ? { refresh: 1 } : {}),
        },
        signal,
        timeout: 0,
      })
    );
  },
};
