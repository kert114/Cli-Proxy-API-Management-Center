import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore, useQuotaStore } from '@/stores';
import { apiClient } from '@/services/api/client';
import {
  githubDashboardApi,
  type GitHubStatistics,
  type GitHubPulls,
} from '@/services/api/githubDashboard';
import { activitySessionScope } from '../activity/session';
import { DashboardCache } from './cache';

const statisticsCache = new DashboardCache<GitHubStatistics>();
const pullsCache = new DashboardCache<GitHubPulls>();
const invalidate = () => {
  statisticsCache.invalidate();
  pullsCache.invalidate();
};
useAuthStore.subscribe((state, previous) => {
  if (
    state.apiBase !== previous.apiBase ||
    state.managementKey !== previous.managementKey ||
    state.isAuthenticated !== previous.isAuthenticated ||
    state.connectionStatus !== previous.connectionStatus
  )
    invalidate();
});
useQuotaStore.subscribe((state, previous) => {
  if (state.cacheGeneration !== previous.cacheGeneration) invalidate();
});

type SnapshotError = 'auth' | 'local' | 'backend' | 'unavailable';
type SnapshotState<T> = { key: string; data?: T; refreshing: boolean; error?: SnapshotError };
export function useDashboardData<T>(
  cache: DashboardCache<T>,
  section: string,
  ttl: number,
  poll: boolean,
  fetcher: (signal: AbortSignal, force: boolean) => Promise<T>,
  enabled = true
) {
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const connected = useAuthStore(
    (state) => enabled && state.isAuthenticated && state.connectionStatus === 'connected'
  );
  const generation = useQuotaStore((state) => state.cacheGeneration);
  const revision = apiClient.getConnectionRevision();
  const session = useMemo(
    () => activitySessionScope(apiBase, managementKey),
    [apiBase, managementKey]
  );
  const key = `${session}:${generation}:${revision}:${section}`;
  const [state, setState] = useState<SnapshotState<T>>();
  const loadRef = useRef<(force?: boolean) => void>(() => {});
  useEffect(() => {
    if (!connected) return;
    let active = true;
    let loading = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let forceNext = false;
    const isCurrent = () =>
      active &&
      apiClient.getConnectionRevision() === revision &&
      useQuotaStore.getState().cacheGeneration === generation &&
      useAuthStore.getState().isAuthenticated;
    const load = (force = false) => {
      forceNext ||= force;
      clearTimeout(timer);
      if (document.hidden || loading || !isCurrent()) return;
      const forced = forceNext;
      forceNext = false;
      loading = true;
      const cached = cache.read(key);
      setState((previous) => ({
        key,
        data: previous?.key === key ? (previous.data ?? cached) : cached,
        refreshing: true,
      }));
      void cache
        .load(key, ttl, (signal) => fetcher(signal, forced), forced)
        .then(
          (data) => {
            if (isCurrent()) setState({ key, data, refreshing: false });
          },
          (error: unknown) => {
            if (!isCurrent()) return;
            const status =
              error && typeof error === 'object' && 'status' in error ? error.status : undefined;
            setState({
              key,
              data: cache.read(key),
              refreshing: false,
              error:
                status === 401
                  ? 'auth'
                  : status === 403
                    ? 'local'
                    : status === 404
                      ? 'backend'
                      : 'unavailable',
            });
          }
        )
        .finally(() => {
          loading = false;
          if (isCurrent() && poll && !document.hidden) timer = setTimeout(() => load(), ttl);
        });
    };
    loadRef.current = load;
    const visibility = () => {
      if (document.hidden) clearTimeout(timer);
      else load();
    };
    document.addEventListener('visibilitychange', visibility);
    load();
    return () => {
      active = false;
      clearTimeout(timer);
      loadRef.current = () => {};
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [connected, cache, key, revision, generation, ttl, poll, fetcher]);
  const current = connected && state?.key === key ? state : undefined;
  return {
    data: current?.data ?? (connected ? cache.read(key) : undefined),
    error: current?.error,
    refreshing: current?.refreshing ?? false,
    connected,
    session: `${session}:${generation}:${revision}`,
    refresh: () => loadRef.current(true),
  };
}
export function useStatistics(year: number, enabled = true) {
  const currentYear = new Date().getUTCFullYear() === year;
  const fetcher = useCallback(
    (signal: AbortSignal, force: boolean) => githubDashboardApi.statistics(year, signal, force),
    [year]
  );
  return useDashboardData(
    statisticsCache,
    `statistics:${year}`,
    currentYear ? 300000 : 30 * 86400000,
    currentYear,
    fetcher,
    enabled
  );
}
export function usePulls() {
  const fetcher = useCallback(
    (signal: AbortSignal, force: boolean) => githubDashboardApi.pulls(signal, force),
    []
  );
  return useDashboardData(pullsCache, 'pulls', 60000, true, fetcher);
}
