import type { ActivityMetric, ChartView, QueueFilter, QueueSort } from './workspace';
import { PREFERENCES_KEY } from './session';
export type WorkspacePreferences = {
  repository: string;
  filter: QueueFilter;
  sort: QueueSort;
  metric: ActivityMetric;
  view: ChartView;
};
export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  repository: '',
  filter: 'all',
  sort: 'attention',
  metric: 'commits',
  view: 'bars',
};
export function readWorkspacePreferences(scope: string): WorkspacePreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('scope' in value) ||
      value.scope !== scope ||
      !('preferences' in value)
    )
      return DEFAULT_PREFERENCES;
    const p = value.preferences;
    if (
      !p ||
      typeof p !== 'object' ||
      !('repository' in p) ||
      typeof p.repository !== 'string' ||
      !('filter' in p) ||
      !('sort' in p) ||
      !('metric' in p) ||
      !('view' in p)
    )
      return DEFAULT_PREFERENCES;
    const filter = p.filter;
    const sort = p.sort;
    const metric = p.metric;
    const view = p.view;
    if (
      (filter === 'all' ||
        filter === 'attention' ||
        filter === 'mine' ||
        filter === 'draft' ||
        filter === 'review' ||
        filter === 'approved') &&
      (sort === 'attention' ||
        sort === 'draft' ||
        sort === 'review' ||
        sort === 'newest' ||
        sort === 'repository') &&
      (metric === 'commits' || metric === 'prs' || metric === 'reviews') &&
      (view === 'bars' || view === 'atlas' || view === 'comparison') &&
      p.repository.length < 150
    ) {
      return { repository: p.repository, filter, sort, metric, view };
    }
  } catch {
    /* Preferences remain usable when browser storage is unavailable. */
  }
  return DEFAULT_PREFERENCES;
}
export function saveWorkspacePreferences(scope: string, preferences: WorkspacePreferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ scope, preferences }));
  } catch {
    /* Session state remains usable. */
  }
}
