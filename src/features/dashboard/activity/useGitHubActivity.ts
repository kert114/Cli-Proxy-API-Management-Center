import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore, useQuotaStore } from '@/stores';
import { apiClient } from '@/services/api/client';
import { githubActivityApi, type GitHubActivity } from '@/services/api/githubActivity';
import { useNow } from '@/hooks/useNow';
import { activityWindow, type ActivityPeriod } from './window';
import { activitySessionScope, activitySnapshots } from './session';
export const ACCOUNT = 'kert114';
export const ORGANIZATION = '60xAI';
const expected = { account: ACCOUNT, organization: ORGANIZATION };
type SnapshotState = {
  key: string;
  data?: GitHubActivity;
  refreshing: boolean;
  error?: 'local' | 'backend' | 'unavailable';
};
export function useGitHubActivity(period: ActivityPeriod, refreshToken: number) {
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const connected = useAuthStore(
    (state) => state.connectionStatus === 'connected' && state.isAuthenticated
  );
  const generation = useQuotaStore((state) => state.cacheGeneration);
  const now = useNow();
  const window = activityWindow(period, new Date(now));
  const { since, until } = window;
  const session = useMemo(
    () => activitySessionScope(apiBase, managementKey),
    [apiBase, managementKey]
  );
  const key = JSON.stringify([apiBase, session, ACCOUNT, ORGANIZATION, since, until]);
  const requestKey = JSON.stringify([key, generation, apiClient.getConnectionRevision()]);
  const [state, setState] = useState<SnapshotState>();
  const lastRefresh = useRef(refreshToken);
  const [manualRefresh, setManualRefresh] = useState(0);
  const lastManual = useRef(manualRefresh);
  useEffect(() => {
    if (!connected) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const revision = apiClient.getConnectionRevision();
    const explicit = lastRefresh.current !== refreshToken || lastManual.current !== manualRefresh;
    lastRefresh.current = refreshToken;
    lastManual.current = manualRefresh;
    let forceRefresh = explicit;
    let loading = false;
    const load = (force = false) => {
      forceRefresh ||= force;
      clearTimeout(timer);
      if (document.hidden || loading) return;
      loading = true;
      const bypassCache = forceRefresh;
      forceRefresh = false;
      const cached = activitySnapshots.read(key, expected);
      setState((previous) => ({
        key: requestKey,
        data: previous?.key === requestKey ? (previous.data ?? cached) : cached,
        refreshing: true,
      }));
      void activitySnapshots
        .refresh(key, expected, async () => {
          const data = await githubActivityApi.getOrganization(
            ACCOUNT,
            ORGANIZATION,
            { since, until },
            undefined,
            bypassCache
          );
          if (revision !== apiClient.getConnectionRevision())
            throw new Error('GitHub session changed');
          return data;
        })
        .then(
          (data) => {
            if (active && revision === apiClient.getConnectionRevision())
              setState({ key: requestKey, data, refreshing: false });
          },
          (error: unknown) => {
            if (!active || revision !== apiClient.getConnectionRevision()) return;
            const status =
              error && typeof error === 'object' && 'status' in error ? error.status : undefined;
            setState((previous) => ({
              key: requestKey,
              data: previous?.key === requestKey ? previous.data : cached,
              refreshing: false,
              error: status === 403 ? 'local' : status === 404 ? 'backend' : 'unavailable',
            }));
          }
        )
        .finally(() => {
          loading = false;
          if (active && !document.hidden) timer = setTimeout(() => load(), 60_000);
        });
    };
    const visibility = () => {
      if (!document.hidden) load();
      else clearTimeout(timer);
    };
    load(explicit);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [connected, key, requestKey, generation, since, until, refreshToken, manualRefresh]);
  const cached = connected ? activitySnapshots.read(key, expected) : undefined;
  const current = connected && state?.key === requestKey ? state : undefined;
  return {
    ...current,
    data: current?.data ?? cached,
    connected,
    window,
    session,
    refresh: () => setManualRefresh((value) => value + 1),
  };
}
