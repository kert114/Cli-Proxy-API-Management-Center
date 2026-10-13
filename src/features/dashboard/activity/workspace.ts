import type { GitHubPullRequest } from '@/services/api/githubActivity';
export type QueueFilter = 'all' | 'attention' | 'mine' | 'draft' | 'review' | 'approved';
export type QueueSort = 'attention' | 'draft' | 'review' | 'newest' | 'repository';
export type ActivityMetric = 'commits' | 'prs' | 'reviews';
export type ChartView = 'bars' | 'atlas' | 'comparison';
export const needsAttention = (pr: GitHubPullRequest) =>
  ['FAILURE', 'ERROR'].includes(pr.checks) ||
  pr.review === 'CHANGES_REQUESTED' ||
  pr.mergeable === 'CONFLICTING';
export const needsReview = (pr: GitHubPullRequest) =>
  !pr.draft && pr.review !== 'APPROVED' && pr.review !== 'CHANGES_REQUESTED';
export function selectPullRequests(
  rows: GitHubPullRequest[],
  options: {
    search: string;
    repository: string;
    filter: QueueFilter;
    sort: QueueSort;
    account: string;
  }
): GitHubPullRequest[] {
  const query = options.search.trim().toLowerCase();
  const matches = (pr: GitHubPullRequest) => {
    switch (options.filter) {
      case 'all':
        return true;
      case 'attention':
        return needsAttention(pr);
      case 'mine':
        return pr.author.toLowerCase() === options.account.toLowerCase();
      case 'draft':
        return pr.draft;
      case 'review':
        return needsReview(pr);
      case 'approved':
        return !pr.draft && pr.review === 'APPROVED';
    }
  };
  const newest = (pr: GitHubPullRequest) =>
    Number.isFinite(Date.parse(pr.createdAt)) ? Date.parse(pr.createdAt) : 0;
  return rows
    .filter(
      (pr) =>
        (!options.repository || pr.repository === options.repository) &&
        matches(pr) &&
        `${pr.title} ${pr.repository} #${pr.number} ${pr.author}`.toLowerCase().includes(query)
    )
    .sort((a, b) => {
      switch (options.sort) {
        case 'attention':
          return (
            Number(needsAttention(b)) - Number(needsAttention(a)) ||
            Number(needsReview(b)) - Number(needsReview(a)) ||
            newest(b) - newest(a)
          );
        case 'draft':
          return Number(b.draft) - Number(a.draft) || newest(b) - newest(a);
        case 'review':
          return Number(needsReview(b)) - Number(needsReview(a)) || newest(b) - newest(a);
        case 'newest':
          return newest(b) - newest(a);
        case 'repository':
          return a.repository.localeCompare(b.repository) || newest(b) - newest(a);
      }
    });
}

export type ListedEvent = { repository: string; title: string; url: string; date: string };
export function listedEvents(
  data: import('@/services/api/githubActivity').GitHubActivity,
  metric: ActivityMetric
): ListedEvent[] {
  switch (metric) {
    case 'commits':
      return data.commits;
    case 'prs':
      return data.createdPRs.map((pr) => ({ ...pr, date: pr.createdAt }));
    case 'reviews':
      return data.reviews;
  }
}
export function activityBuckets(
  window: { since: string; until: string },
  period: import('./window').ActivityPeriod,
  now = new Date()
) {
  const buckets: { since: number; until: number }[] = [];
  const until = Math.min(Date.parse(window.until), now.getTime());
  let cursor = new Date(window.since);
  while (cursor.getTime() < until && buckets.length < 366) {
    const next = new Date(cursor);
    if (period === 'year') next.setMonth(next.getMonth() + 1);
    else if (period === 'day') next.setTime(next.getTime() + 60 * 60 * 1000);
    else next.setDate(next.getDate() + 1);
    buckets.push({
      since: cursor.getTime(),
      until: Math.min(next.getTime(), until),
    });
    cursor = next;
  }
  return buckets;
}
export const listedCount = (
  events: ListedEvent[],
  bucket: { since: number; until: number },
  repository = ''
) => {
  const count = events.filter(
    (event) =>
      (!repository || event.repository === repository) &&
      Date.parse(event.date) >= bucket.since &&
      Date.parse(event.date) < bucket.until
  ).length;
  return count || null;
};
