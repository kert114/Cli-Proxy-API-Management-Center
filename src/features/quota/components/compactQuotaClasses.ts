import type { QuotaClassMap } from '../types';
import styles from './CompactQuota.module.scss';

export function compactQuotaClasses(classes: QuotaClassMap, compact: boolean): QuotaClassMap {
  return compact
    ? {
        ...classes,
        quotaPercent: `${classes.quotaPercent} ${styles.percent}`,
        quotaReset: `${classes.quotaReset} ${styles.reset}`,
        quotaResetRelative: `${classes.quotaResetRelative} ${styles.relative}`,
        quotaRow: `${classes.quotaRow} ${styles.row}`,
        quotaBar: `${classes.quotaBar} ${styles.bar}`,
        codexPlan: `${classes.codexPlan} ${styles.plan}`,
        codexResetCredits: `${classes.codexResetCredits} ${styles.credits}`,
        codexResetCreditRow: `${classes.codexResetCreditRow} ${styles.creditRow}`,
        codexResetCreditTime: `${classes.codexResetCreditTime} ${styles.creditTime}`,
        codexResetCreditsTitle: `${classes.codexResetCreditsTitle} ${styles.creditTitle}`,
        quotaRowHeader: `${classes.quotaRowHeader} ${styles.header}`,
        quotaModel: `${classes.quotaModel} ${styles.label}`,
        quotaMeta: `${classes.quotaMeta} ${styles.meta}`,
      }
    : classes;
}
