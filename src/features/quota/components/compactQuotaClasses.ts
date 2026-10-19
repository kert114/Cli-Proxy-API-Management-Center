import type { QuotaClassMap } from '../types';
import styles from './CompactQuota.module.scss';

export function compactQuotaClasses(classes: QuotaClassMap, compact: boolean): QuotaClassMap {
  return compact
    ? {
        ...classes,
        quotaRowHeader: `${classes.quotaRowHeader} ${styles.header}`,
        quotaModel: `${classes.quotaModel} ${styles.label}`,
        quotaMeta: `${classes.quotaMeta} ${styles.meta}`,
      }
    : classes;
}
