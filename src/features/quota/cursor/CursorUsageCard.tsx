import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { QuotaMeter } from '../components/QuotaMeter';
import { bindQuotaClasses } from '../types';
import type { CursorUsageState } from './useCursorUsage';
import cardStyles from '../components/QuotaCard.module.scss';
import bodyStyles from '../components/QuotaBody.module.scss';

const classes = bindQuotaClasses(bodyStyles, 'CursorUsageCard');

export function CursorUsageCard({
  state,
  disabled,
  onRefresh,
}: {
  state: CursorUsageState;
  disabled: boolean;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
  const date = (value: string) => new Date(value).toLocaleString(locale);
  const snapshot = state.status === 'success' ? state.snapshot : null;
  const loading = state.status === 'loading';
  const unknown = t('cursor_usage.not_reported');

  return (
    <article className={cardStyles.card} aria-label={t('cursor_usage.title')}>
      <header className={cardStyles.head}>
        <span className={cardStyles.iconWrap} title="Cursor">
          <span className={cardStyles.iconFallback}>C</span>
        </span>
        <span className={cardStyles.fileName} title={t('cursor_usage.description')}>
          {t('cursor_usage.account')}
        </span>
      </header>
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
        {snapshot && (
          <>
            <div className={classes.codexPlan}>
              <span className={classes.codexPlanItem}>
                <span className={classes.codexPlanLabel}>{t('cursor_usage.plan')}</span>
                <span className={classes.codexPlanValue}>{snapshot.plan ?? unknown}</span>
              </span>
              <span className={classes.codexPlanItem}>
                <span className={classes.codexPlanLabel}>{t('cursor_usage.on_demand')}</span>
                <span className={classes.codexPlanValue}>
                  {snapshot.onDemand ? currency.format(snapshot.onDemand.usedUsd) : unknown}
                </span>
              </span>
              <span className={classes.codexPlanItem}>
                <span className={classes.codexPlanLabel}>{t('cursor_usage.limit')}</span>
                <span className={classes.codexPlanValue}>
                  {snapshot.onDemand?.limit.kind === 'fixed'
                    ? currency.format(snapshot.onDemand.limit.usd)
                    : t(`cursor_usage.limit_${snapshot.onDemand?.limit.kind ?? 'unavailable'}`)}
                </span>
              </span>
              <span className={classes.codexPlanItem}>
                <span className={classes.codexPlanLabel}>{t('cursor_usage.resets')}</span>
                <span className={classes.codexPlanValue}>
                  {snapshot.resetsAt ? (
                    <time dateTime={snapshot.resetsAt}>{date(snapshot.resetsAt)}</time>
                  ) : (
                    unknown
                  )}
                </span>
              </span>
              <span className={classes.codexPlanItem}>
                <span className={classes.codexPlanLabel}>{t('cursor_usage.checked')}</span>
                <span className={classes.codexPlanValue}>
                  <time dateTime={snapshot.checkedAt}>{date(snapshot.checkedAt)}</time>
                </span>
              </span>
            </div>
            {(
              [
                ['included', snapshot.included.percentUsed],
                ['auto', snapshot.included.autoPercentUsed],
                ['api', snapshot.included.apiPercentUsed],
              ] as const
            ).map(([id, used], index) => {
              const remaining = used === null ? null : Math.max(0, 100 - used);
              return (
                <div key={id} className={classes.quotaRow}>
                  <div className={classes.quotaRowHeader}>
                    <span className={classes.quotaModel}>{t(`cursor_usage.${id}`)}</span>
                    <div className={classes.quotaMeta}>
                      <span className={classes.quotaPercent}>
                        {used === null
                          ? unknown
                          : t('cursor_usage.used', { value: number.format(used) })}
                      </span>
                    </div>
                  </div>
                  <div
                    role={remaining === null ? undefined : 'meter'}
                    aria-label={t(`cursor_usage.${id}_remaining`)}
                    aria-valuemin={remaining === null ? undefined : 0}
                    aria-valuemax={remaining === null ? undefined : 100}
                    aria-valuenow={remaining ?? undefined}
                  >
                    <QuotaMeter percent={remaining} classes={classes} index={index} />
                  </div>
                </div>
              );
            })}
            {snapshot.partial && (
              <div className={classes.quotaMessage}>{t('cursor_usage.partial')}</div>
            )}
          </>
        )}
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
    </article>
  );
}
