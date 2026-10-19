import { useTranslation } from 'react-i18next';
import type { DashboardSnapshot } from '@/services/api/githubDashboard';
import styles from './Workspace.module.scss';
export function SnapshotStatus({
  data,
  refreshing,
  error,
  connected,
}: {
  data?: DashboardSnapshot;
  refreshing: boolean;
  error?: 'auth' | 'local' | 'backend' | 'unavailable';
  connected: boolean;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className={styles.status}>
      <span role="status" aria-live="polite">
        {refreshing
          ? t('workspace.refreshing')
          : data
            ? t('work_dashboard.checked', {
                at: new Date(data.checkedAt).toLocaleString(i18n.language),
              })
            : connected
              ? t('workspace.not_checked')
              : t('cursor_usage.disconnected')}
        {data?.stale && ` / ${t('work_dashboard.saved_snapshot')}`}
      </span>
      {error && (
        <span role="alert">
          {t(`workspace.error_${error}`)}
          {data && ` ${t('work_dashboard.retained_snapshot')}`}
        </span>
      )}
      {!error && data?.stale && <span role="alert">{t('workspace.stale')}</span>}
    </div>
  );
}
