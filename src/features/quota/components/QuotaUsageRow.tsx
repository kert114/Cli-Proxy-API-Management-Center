import type { ReactNode } from 'react';
import type { QuotaClassMap } from '../types';
import { QuotaMeter } from './QuotaMeter';

interface QuotaUsageRowProps {
  label: string;
  usedPercent: number | null;
  classes: QuotaClassMap;
  index?: number;
  title?: string;
  unknownLabel?: string;
  meterLabel?: string;
  children?: ReactNode;
}

export function QuotaUsageRow({
  label,
  usedPercent,
  classes,
  index,
  title,
  unknownLabel = '--',
  meterLabel = label,
  children,
}: QuotaUsageRowProps) {
  const clampedUsed = usedPercent === null ? null : Math.max(0, Math.min(100, usedPercent));
  const remaining = clampedUsed === null ? null : Math.max(0, Math.min(100, 100 - clampedUsed));
  const percentLabel = remaining === null ? unknownLabel : `${Math.round(remaining)}%`;

  return (
    <div className={classes.quotaRow} title={title}>
      <div className={classes.quotaRowHeader}>
        <span className={classes.quotaModel}>{label}</span>
        <div className={classes.quotaMeta}>
          <span className={classes.quotaPercent}>{percentLabel}</span>
          {children}
        </div>
      </div>
      <div
        role={remaining === null ? undefined : 'meter'}
        aria-label={meterLabel}
        aria-valuemin={remaining === null ? undefined : 0}
        aria-valuemax={remaining === null ? undefined : 100}
        aria-valuenow={remaining ?? undefined}
      >
        <QuotaMeter percent={remaining} classes={classes} index={index} />
      </div>
    </div>
  );
}
