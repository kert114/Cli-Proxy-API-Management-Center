import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconRefreshCw } from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { agentActivityApi, type ActivityResult } from '@/services/api/agentActivity';
import { apiClient } from '@/services/api/client';
import { useAuthStore } from '@/stores';
import pageStyles from '@/features/dashboard/WorkDashboard.module.scss';
import { AgentActivityHostCard } from './AgentActivityHostCard';
import styles from './AgentActivityPage.module.scss';

const REFRESH_MS = 5000;

function AgentActivityView({ revision }: { revision: number }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<ActivityResult>();
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const refresh = useCallback(() => refreshRef.current?.(), []);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const isCurrent = () =>
      !controller.signal.aborted && apiClient.getConnectionRevision() === revision;
    const load = async () => {
      if (document.hidden || inFlight || !isCurrent()) return;
      clearTimeout(timer);
      inFlight = true;
      setRefreshing(true);
      try {
        const snapshot = await agentActivityApi.snapshot(controller.signal);
        if (isCurrent()) setResult(snapshot);
      } finally {
        inFlight = false;
        if (isCurrent()) {
          setRefreshing(false);
          if (!document.hidden) timer = setTimeout(() => void load(), REFRESH_MS);
        }
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) clearTimeout(timer);
      else void load();
    };
    refreshRef.current = load;
    document.addEventListener('visibilitychange', onVisibilityChange);
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
      refreshRef.current = undefined;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [revision]);

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
                  ? t('agent_activity.outage')
                  : t('common.loading')
            }
            description={
              result && result.status !== 'ok'
                ? t(`agent_activity.status.${result.status}`, {
                    statusCode: 'statusCode' in result ? result.statusCode : undefined,
                  })
                : undefined
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
