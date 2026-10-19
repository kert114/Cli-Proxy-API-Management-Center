import { useTranslation } from 'react-i18next';
import { CollapseButton } from '@/components/ui/CollapseButton';
import { IconRefreshCw } from '@/components/ui/icons';
import { useCountUp } from '@/hooks/motion';
import styles from './QuotaHeader.module.scss';

export type QuotaHeaderProps = {
  embedded?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  controls?: string;
  checkedAt?: number;
  totalCount: number;
  loadedCount: number;
  attentionCount: number;
  refreshing: boolean;
  disableControls: boolean;
  onRefreshAll: () => void;
};

export function QuotaHeader(props: QuotaHeaderProps) {
  const {
    embedded,
    collapsed,
    onToggle,
    controls,
    checkedAt,
    totalCount,
    loadedCount,
    attentionCount,
    refreshing,
    disableControls,
    onRefreshAll,
  } = props;
  const { t } = useTranslation();
  // Animate the count as each provider finishes loading.
  const displayLoadedCount = useCountUp(loadedCount);
  const Heading = embedded ? 'h2' : 'h1';

  return (
    <header className={`${styles.header} ${embedded ? styles.embedded : ''}`}>
      <div className={styles.copy}>
        <div className={styles.titleRow}>
          {embedded && onToggle && controls && (
            <CollapseButton
              collapsed={collapsed ?? false}
              onClick={onToggle}
              label={t('work_dashboard.current_quotas')}
              controls={controls}
            />
          )}
          <Heading className={styles.title} data-reveal>
            {t(embedded ? 'work_dashboard.current_quotas' : 'quota_management.title')}
          </Heading>
        </div>
        <p className={styles.meta} data-reveal>
          <span className={styles.metaTotal}>
            {t('quota_management.meta_credentials', { count: totalCount })}
          </span>
          <span className={styles.metaDot} aria-hidden="true">
            ·
          </span>
          <span className={loadedCount > 0 ? styles.metaLoaded : styles.metaMuted}>
            {t('quota_management.meta_loaded', { count: displayLoadedCount })}
          </span>
          {attentionCount > 0 && (
            <>
              <span className={styles.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.metaAttention}>
                {t('quota_management.meta_attention', { count: attentionCount })}
              </span>
            </>
          )}
        </p>
      </div>
      <div className={styles.actions} data-reveal>
        <span className={styles.checked} role="status" aria-live="polite">
          {refreshing
            ? t('workspace.refreshing')
            : checkedAt
              ? t('work_dashboard.checked', { at: new Date(checkedAt).toLocaleTimeString() })
              : ''}
        </span>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={onRefreshAll}
          disabled={disableControls || refreshing}
        >
          <IconRefreshCw size={14} className={refreshing ? styles.spinning : undefined} />
          {t(embedded ? 'workspace.refresh_quotas' : 'quota_management.refresh_all_credentials')}
        </button>
      </div>
    </header>
  );
}
