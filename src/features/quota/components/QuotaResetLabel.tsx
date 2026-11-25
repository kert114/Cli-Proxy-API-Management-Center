/**
 * `Fri, 2:12 PM · 1d5h` — the local reset time plus its countdown.
 *
 * Shared by every provider body so the two halves can never drift apart in
 * markup or spacing. The separator lives in CSS (`.quotaResetRelative::before`)
 * rather than here, so the relative half stays independently styleable.
 */

import type { ResetDisplay } from '@/utils/quota';
import type { QuotaClassMap } from '../types';

export interface QuotaResetLabelProps {
  display: ResetDisplay;
  classes: QuotaClassMap;
  absoluteClassName?: string;
  /** True on the row that recovers first for this credential. */
  soon?: boolean;
}

export function QuotaResetLabel({
  display,
  classes,
  absoluteClassName = classes.quotaReset,
  soon = false,
}: QuotaResetLabelProps) {
  return (
    <>
      {display.dateTime ? (
        <time className={absoluteClassName} dateTime={display.dateTime} title={display.title}>
          {display.absolute}
        </time>
      ) : (
        <span className={absoluteClassName}>{display.absolute}</span>
      )}
      {display.relative && (
        <span
          className={
            soon
              ? `${classes.quotaResetRelative} ${classes.quotaResetRelativeSoon}`
              : classes.quotaResetRelative
          }
        >
          {display.relative}
        </span>
      )}
    </>
  );
}
