import { ACCOUNT, type DashboardPullRequest } from '@/services/api/githubDashboard';
export const PULL_FILTERS = [
  'all',
  'open',
  'merged',
  'closed',
  'attention',
  'draft',
  'review',
  'approved',
  'conflicts',
  'checks_failed',
  'mine',
] as const;
export type PullFilter = (typeof PULL_FILTERS)[number];
export function matchesPullFilter(pr: DashboardPullRequest, filter: PullFilter) {
  const open = pr.state === 'OPEN';
  switch (filter) {
    case 'all':
      return true;
    case 'open':
      return open;
    case 'merged':
      return pr.state === 'MERGED';
    case 'closed':
      return pr.state === 'CLOSED';
    case 'attention':
      return (
        open &&
        (pr.mergeable === 'CONFLICTING' ||
          pr.review === 'CHANGES_REQUESTED' ||
          ['FAILURE', 'ERROR'].includes(pr.checks))
      );
    case 'draft':
      return open && pr.draft;
    case 'review':
      return open && !pr.draft && pr.review !== 'APPROVED' && pr.review !== 'CHANGES_REQUESTED';
    case 'approved':
      return open && !pr.draft && pr.review === 'APPROVED';
    case 'conflicts':
      return open && pr.mergeable === 'CONFLICTING';
    case 'checks_failed':
      return open && ['FAILURE', 'ERROR'].includes(pr.checks);
    case 'mine':
      return pr.author === ACCOUNT;
  }
}
export function groupPullRequests(
  rows: DashboardPullRequest[],
  options: { filter: PullFilter; repository: string; search: string }
) {
  const query = options.search.trim().toLowerCase();
  const groups = new Map<string, DashboardPullRequest[]>();
  const newest = (a: DashboardPullRequest, b: DashboardPullRequest) =>
    Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.number - a.number;
  rows
    .filter(
      (pr) =>
        matchesPullFilter(pr, options.filter) &&
        (!options.repository || pr.repository === options.repository) &&
        `${pr.repository} #${pr.number} ${pr.title} ${pr.author}`.toLowerCase().includes(query)
    )
    .sort(newest)
    .forEach((pr) => {
      const group = groups.get(pr.repository) ?? [];
      group.push(pr);
      groups.set(pr.repository, group);
    });
  return Array.from(groups, ([repository, pullRequests]) => ({ repository, pullRequests })).sort(
    (a, b) =>
      newest(a.pullRequests[0], b.pullRequests[0]) || a.repository.localeCompare(b.repository)
  );
}
export const checksLabel = (checks: string) =>
  checks === 'SUCCESS'
    ? 'checks_passed'
    : ['FAILURE', 'ERROR'].includes(checks)
      ? 'checks_failed'
      : ['PENDING', 'EXPECTED'].includes(checks)
        ? 'checks_pending'
        : 'checks_none';
export const reviewLabel = (review: string) =>
  review === 'APPROVED'
    ? 'approved'
    : review === 'CHANGES_REQUESTED'
      ? 'changes_requested'
      : review === 'REVIEW_REQUIRED'
        ? 'review_required'
        : 'review_none';
