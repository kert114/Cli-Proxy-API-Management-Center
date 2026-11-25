import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTransitionLayer } from '@/components/common/PageTransitionLayer';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconRefreshCw } from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import {
  agentActivityApi,
  type ActivityHost,
  type ActivityResult,
} from '@/services/api/agentActivity';
import { apiClient } from '@/services/api/client';
import { useAuthStore } from '@/stores';
import { isLoopbackApiBase } from '@/utils/connection';
import { formatRelativeInstant } from '@/utils/quota/relativeTime';
import pageStyles from '@/features/dashboard/WorkDashboard.module.scss';
import { AgentActivityHostCard } from './AgentActivityHostCard';
import styles from './AgentActivityPage.module.scss';

const REFRESH_MS = 5000;

function AgentActivityView({ revision, local }: { revision: number; local: boolean }) {
  const { t, i18n } = useTranslation();
  const layer = usePageTransitionLayer();
  const pollingEnabled = local && (layer?.isCurrentLayer ?? true);
  const [sample, setSample] = useState<{ hosts: ActivityHost[]; receivedAt: number }>();
  const [failure, setFailure] = useState<{
    result: Exclude<ActivityResult, { status: 'ok' }>;
    checkedAt: number;
  }>();
  const [refreshing, setRefreshing] = useState(false);
  const refreshPending = pollingEnabled && refreshing;
  const refreshRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const refresh = useCallback(() => refreshRef.current?.(), []);

  useLayoutEffect(() => {
    if (!pollingEnabled) return;

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
        if (!isCurrent()) return;
        const checkedAt = performance.now();
        if (snapshot.status === 'ok') {
          setSample({ hosts: snapshot.hosts, receivedAt: checkedAt });
          setFailure(undefined);
        } else {
          setFailure({ result: snapshot, checkedAt });
        }
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
  }, [pollingEnabled, revision]);

  useHeaderRefresh(refresh, pollingEnabled);

  const relativeAge =
    sample && failure
      ? failure.checkedAt - sample.receivedAt < 60_000
        ? new Intl.RelativeTimeFormat(i18n.resolvedLanguage).format(
            -Math.floor((failure.checkedAt - sample.receivedAt) / 1000),
            'second'
          )
        : formatRelativeInstant(sample.receivedAt, failure.checkedAt, i18n.resolvedLanguage)
      : undefined;
  const error = failure?.result;

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <div className={styles.heading}>
          <h1>{t('nav.agent_activity')}</h1>
          {local && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refresh()}
              loading={refreshPending}
            >
              {!refreshPending && <IconRefreshCw size={14} aria-hidden="true" />}{' '}
              {t('common.refresh')}
            </Button>
          )}
        </div>
      </header>
      {!local && (
        <div role="status">
          <EmptyState title={t('agent_activity.local_only')} />
        </div>
      )}
      {error && (
        <div role="status">
          <EmptyState
            title={t('agent_activity.outage')}
            description={t(`agent_activity.status.${error.status}`, {
              statusCode: 'statusCode' in error ? error.statusCode : undefined,
            })}
          />
        </div>
      )}
      {relativeAge && (
        <p className={styles.notice}>{t('agent_activity.stale_refresh', { age: relativeAge })}</p>
      )}
      {sample && sample.hosts.length > 0 && (
        <div className={styles.hosts}>
          {sample.hosts.map((host) => (
            <AgentActivityHostCard key={host.name} host={host} />
          ))}
        </div>
      )}
      {local && (sample ? sample.hosts.length === 0 : !error) && (
        <div role="status">
          <EmptyState title={sample ? t('agent_activity.empty') : t('common.loading')} />
        </div>
      )}
    </div>
  );
}

export function AgentActivityPage() {
  const connected = useAuthStore(
    (state) => state.isAuthenticated && state.connectionStatus === 'connected'
  );
  const apiBase = useAuthStore((state) => state.apiBase);
  const revision = useAuthStore(() => apiClient.getConnectionRevision());
  return connected ? (
    <AgentActivityView key={revision} revision={revision} local={isLoopbackApiBase(apiBase)} />
  ) : null;
}
