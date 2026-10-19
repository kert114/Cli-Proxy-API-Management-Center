import { useId } from 'react';
import { CollapseButton } from '@/components/ui/CollapseButton';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { bindQuotaClasses } from '../types';
import { compactQuotaClasses } from '../components/compactQuotaClasses';
import { CursorUsageBody } from './CursorUsageBody';
import type { CursorUsageState } from './useCursorUsage';
import cardStyles from '../components/QuotaCard.module.scss';
import bodyStyles from '../components/QuotaBody.module.scss';

const baseClasses = bindQuotaClasses(bodyStyles, 'CursorUsageCard');

export function CursorUsageCard({
  state,
  disabled,
  onRefresh,
  compact = false,
  collapsed = false,
  onToggleCollapse,
}: {
  state: CursorUsageState;
  disabled: boolean;
  onRefresh: () => void;
  compact?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { t } = useTranslation();
  const contentId = useId();
  const classes = compactQuotaClasses(baseClasses, compact);
  const snapshot = state.status === 'success' ? state.snapshot : null;
  const loading = state.status === 'loading';

  return (
    <article className={cardStyles.card} aria-label={t('cursor_usage.title')}>
      <header className={cardStyles.head}>
        <span className={cardStyles.iconWrap} title="Cursor">
          <span className={cardStyles.iconFallback}>C</span>
        </span>
        <span className={cardStyles.fileName} title={t('cursor_usage.description')}>
          {t('cursor_usage.account')}
        </span>
        {onToggleCollapse && (
          <span className={cardStyles.collapseControl}>
            <CollapseButton
              collapsed={collapsed}
              onClick={onToggleCollapse}
              label={t('cursor_usage.account')}
              controls={contentId}
            />
          </span>
        )}
      </header>
      <div className={cardStyles.content} id={contentId} hidden={collapsed}>
        <div className={cardStyles.body}>
          {(loading || state.status === 'idle') && (
            <div role="status" className={classes.quotaMessage}>
              {t(loading ? 'cursor_usage.loading' : 'cursor_usage.disconnected')}
            </div>
          )}
          {state.status === 'error' && (
            <div role="alert" className={cardStyles.errorStrip}>
              {t(`cursor_usage.error_${state.reason}`)}
            </div>
          )}
          {snapshot && <CursorUsageBody snapshot={snapshot} classes={classes} />}
        </div>
        <footer className={cardStyles.actionRow}>
          <button
            type="button"
            className={cardStyles.actionPill}
            onClick={onRefresh}
            disabled={disabled || loading}
            aria-label={t('cursor_usage.refresh')}
            title={t('auth_files.quota_refresh_hint')}
          >
            <IconRefreshCw
              size={13}
              aria-hidden="true"
              className={loading ? cardStyles.spinning : undefined}
            />
            {t('auth_files.quota_refresh_single')}
          </button>
        </footer>
      </div>
    </article>
  );
}
