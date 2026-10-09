import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import { buildResetDisplay } from '@/utils/quota';
import { HOUR_MS } from '@/utils/time/durations';
import { QuotaResetLabel } from '../components/QuotaResetLabel';
import { QuotaUsageRow } from '../components/QuotaUsageRow';
import type { QuotaClassMap } from '../types';
import type { CursorUsageSnapshot } from '@/services/api/cursorUsage';

export function CursorUsageBody({
  snapshot,
  classes,
}: {
  snapshot: CursorUsageSnapshot;
  classes: QuotaClassMap;
}) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const locale = i18n.resolvedLanguage;
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
  const date = (value: string) => new Date(value).toLocaleString(locale);
  const unknown = t('cursor_usage.not_reported');
  const resetMs = snapshot.resetsAt === null ? Number.NaN : Date.parse(snapshot.resetsAt);
  const resetDisplay = Number.isFinite(resetMs)
    ? buildResetDisplay(null, resetMs, now, locale)
    : null;
  const soon = Number.isFinite(resetMs) && resetMs - now > 0 && resetMs - now < HOUR_MS;

  return (
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
      ).map(([id, used], index) => (
        <QuotaUsageRow
          key={id}
          label={t(`cursor_usage.${id}`)}
          usedPercent={used}
          classes={classes}
          index={index}
          unknownLabel={unknown}
          meterLabel={t(`cursor_usage.${id}_remaining`)}
          title={soon ? t('quota_management.soonest_row_hint') : undefined}
        >
          {resetDisplay && <QuotaResetLabel display={resetDisplay} classes={classes} soon={soon} />}
        </QuotaUsageRow>
      ))}
      {snapshot.partial && <div className={classes.quotaMessage}>{t('cursor_usage.partial')}</div>}
    </>
  );
}
