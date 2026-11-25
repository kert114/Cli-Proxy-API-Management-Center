import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconRefreshCw } from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useInterval } from '@/hooks/useInterval';
import { agentActivityApi, type ActivityResult } from '@/services/api/agentActivity';
import { apiClient } from '@/services/api/client';
import { useAuthStore } from '@/stores';
import pageStyles from '@/features/dashboard/WorkDashboard.module.scss';
import { AgentActivityHostCard } from './AgentActivityHostCard';
import styles from './AgentActivityPage.module.scss';

const REFRESH_MS = 5000;

function AgentActivityView({ revision }: { revision: number }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<ActivityResult | { status: 'error' }>();
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (request.current || apiClient.getConnectionRevision() !== revision) return;
    const controller = new AbortController();
    request.current = controller;
    setRefreshing(true);
    const isCurrent = () =>
      !controller.signal.aborted && apiClient.getConnectionRevision() === revision;
    try {
      const snapshot = await agentActivityApi.snapshot(controller.signal);
      if (isCurrent()) setResult(snapshot);
    } catch {
      if (isCurrent()) setResult({ status: 'error' });
    } finally {
      if (request.current === controller) request.current = null;
      if (isCurrent()) setRefreshing(false);
    }
  }, [revision]);

  const refreshWhenVisible = useCallback(() => {
    if (!document.hidden) void refresh();
  }, [refresh]);

  useEffect(() => {
    document.addEventListener('visibilitychange', refreshWhenVisible);
    refreshWhenVisible();
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      request.current?.abort();
      request.current = null;
    };
  }, [refreshWhenVisible]);

  useInterval(refreshWhenVisible, REFRESH_MS);
  useHeaderRefresh(refresh);

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <div className={styles.heading}>
          <h1>{t('nav.agent_activity')}</h1>
          <Button variant="secondary" size="sm" onClick={() => void refresh()} loading={refreshing}>
            {!refreshing && <IconRefreshCw size={14} aria-hidden="true" />} {t('common.refresh')}
          </Button>
        </div>
      </header>
      {result?.status === 'ok' && result.hosts.length ? (
        <div className={styles.hosts}>
          {result.hosts.map((host) => (
            <AgentActivityHostCard key={host.name} host={host} />
          ))}
        </div>
      ) : (
        <div role="status">
          <EmptyState
            title={
              result?.status === 'ok'
                ? t('agent_activity.empty')
                : result
                  ? t(`agent_activity.status.${result.status}`)
                  : t('common.loading')
            }
            description={
              result?.status === 'unavailable' ? t('agent_activity.start_dashboard') : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

export function AgentActivityPage() {
  const connected = useAuthStore(
    (state) => state.isAuthenticated && state.connectionStatus === 'connected'
  );
  const revision = useAuthStore(() => apiClient.getConnectionRevision());
  return connected ? <AgentActivityView key={revision} revision={revision} /> : null;
}
