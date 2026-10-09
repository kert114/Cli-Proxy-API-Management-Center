import type { QuotaProviderType } from './providers/types';

/** Credential provider order used for classification and cache pruning. */
export const QUOTA_TAB_ORDER: readonly QuotaProviderType[] = [
  'claude',
  'antigravity',
  'codex',
  'xai',
  'kimi',
  'devin',
  'meta',
];

export type QuotaTabId = 'all' | QuotaProviderType | 'cursor';

export const QUOTA_WORKBENCH_ORDER: readonly Exclude<QuotaTabId, 'all'>[] = [
  'cursor',
  ...QUOTA_TAB_ORDER,
];

/** Twenty accounts per page also bounds refresh-all upstream concurrency. */
export const QUOTA_PAGE_SIZE = 20;

/** Sort by provider order or the next recovery time. */
export const QUOTA_SORT_MODES = ['default', 'soonest'] as const;

export type QuotaSortMode = (typeof QUOTA_SORT_MODES)[number];

/** Match useRevealGroup's total entrance budget. */
export const CARD_ENTRANCE_BUDGET_MS = 360;
