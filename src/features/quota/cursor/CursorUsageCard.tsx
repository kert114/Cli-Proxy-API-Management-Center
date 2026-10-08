import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { QuotaMeter } from '../components/QuotaMeter';
import { bindQuotaClasses } from '../types';
import type { CursorUsageState } from './useCursorUsage';
import cardStyles from '../components/QuotaCard.module.scss';
import bodyStyles from '../components/QuotaBody.module.scss';
import styles from './CursorUsageCard.module.scss';

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
    <section aria-label={t('cursor_usage.title')}>
      <article className={cardStyles.card}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{t('cursor_usage.title')}</h2>
            <p className={styles.description}>{t('cursor_usage.description')}</p>
          </div>
          <button
            type="button"
            className={cardStyles.actionPill}
            onClick={onRefresh}
            disabled={disabled || loading}
            aria-label={t('cursor_usage.refresh')}
          >
            <IconRefreshCw size={14} aria-hidden="true" />
            {t('cursor_usage.refresh')}
          </button>
        </div>
        {(loading || state.status === 'idle') && (
          <p role="status" className={styles.description}>
            {t(loading ? 'cursor_usage.loading' : 'cursor_usage.disconnected')}
          </p>
        )}
        {state.status === 'error' && (
          <p role="status" className={cardStyles.errorStrip}>
            {t(`cursor_usage.error_${state.reason}`)}
          </p>
        )}
        {snapshot && (
          <>
            <div className={styles.metrics}>
              {(
                [
                  ['included', snapshot.included.percentUsed],
                  ['auto', snapshot.included.autoPercentUsed],
                  ['api', snapshot.included.apiPercentUsed],
                ] as const
              ).map(([id, used]) => {
                const remaining = used === null ? null : Math.max(0, 100 - used);
                return (
                  <div key={id} className={classes.quotaRow}>
                    <div className={classes.quotaRowHeader}>
                      <span className={classes.quotaModel}>{t(`cursor_usage.${id}`)}</span>
                      <span className={classes.quotaPercent}>
                        {used === null
                          ? unknown
                          : t('cursor_usage.used', { value: number.format(used) })}
                      </span>
                    </div>
                    <div
                      role={remaining === null ? undefined : 'meter'}
                      aria-label={t(`cursor_usage.${id}_remaining`)}
                      aria-valuemin={remaining === null ? undefined : 0}
                      aria-valuemax={remaining === null ? undefined : 100}
                      aria-valuenow={remaining ?? undefined}
                    >
                      <QuotaMeter percent={remaining} classes={classes} />
                    </div>
                  </div>
                );
              })}
            </div>
            <dl className={styles.details}>
              <div>
                <dt>{t('cursor_usage.plan')}</dt>
                <dd>{snapshot.plan ?? unknown}</dd>
              </div>
              <div>
                <dt>{t('cursor_usage.on_demand')}</dt>
                <dd>{snapshot.onDemand ? currency.format(snapshot.onDemand.usedUsd) : unknown}</dd>
              </div>
              <div>
                <dt>{t('cursor_usage.limit')}</dt>
                <dd>
                  {snapshot.onDemand?.limit.kind === 'fixed'
                    ? currency.format(snapshot.onDemand.limit.usd)
                    : t(`cursor_usage.limit_${snapshot.onDemand?.limit.kind ?? 'unavailable'}`)}
                </dd>
              </div>
              <div>
                <dt>{t('cursor_usage.resets')}</dt>
                <dd>
                  {snapshot.resetsAt ? (
                    <time dateTime={snapshot.resetsAt}>{date(snapshot.resetsAt)}</time>
                  ) : (
                    unknown
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('cursor_usage.checked')}</dt>
                <dd>
                  <time dateTime={snapshot.checkedAt}>{date(snapshot.checkedAt)}</time>
                </dd>
              </div>
            </dl>
            {snapshot.partial && <p className={styles.description}>{t('cursor_usage.partial')}</p>}
          </>
        )}
      </article>
    </section>
  );
}
