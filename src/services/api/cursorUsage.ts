import { apiClient } from './client';

type CursorSpendingLimit =
  { kind: 'fixed'; usd: number } | { kind: 'disabled' | 'unlimited' | 'unavailable' };

export class CursorUsageError extends Error {
  constructor(public readonly reason: 'login' | 'local' | 'unavailable') {
    super('Cursor usage is unavailable');
  }
}

export interface CursorUsageSnapshot {
  plan: string | null;
  checkedAt: string;
  resetsAt: string | null;
  included: {
    percentUsed: number | null;
    autoPercentUsed: number | null;
    apiPercentUsed: number | null;
  };
  onDemand: { usedUsd: number; limit: CursorSpendingLimit } | null;
  partial: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function measurement(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function timestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

export function parseCursorUsage(payload: unknown): CursorUsageSnapshot {
  if (!isRecord(payload) || !isRecord(payload.included)) {
    throw new Error('Invalid Cursor usage response');
  }
  const checkedAt = timestamp(payload.checked_at);
  if (!checkedAt) throw new Error('Invalid Cursor usage response');
  let onDemand: CursorUsageSnapshot['onDemand'] = null;
  if (isRecord(payload.on_demand)) {
    const usedUsd = measurement(payload.on_demand.used_usd);
    const limitUsd = measurement(payload.on_demand.limit_usd);
    const kind = payload.on_demand.limit_kind;
    const limit: CursorSpendingLimit =
      kind === 'fixed' && limitUsd !== null
        ? { kind, usd: limitUsd }
        : kind === 'disabled' || kind === 'unlimited'
          ? { kind }
          : { kind: 'unavailable' };
    if (usedUsd !== null) onDemand = { usedUsd, limit };
  }
  return {
    plan: typeof payload.plan === 'string' && payload.plan.trim() ? payload.plan : null,
    checkedAt,
    resetsAt: timestamp(payload.resets_at),
    included: {
      percentUsed: measurement(payload.included.percent_used),
      autoPercentUsed: measurement(payload.included.auto_percent_used),
      apiPercentUsed: measurement(payload.included.api_percent_used),
    },
    onDemand,
    partial: Array.isArray(payload.warnings) && payload.warnings.length > 0,
  };
}

export const cursorUsageApi = {
  async get(signal?: AbortSignal): Promise<CursorUsageSnapshot> {
    try {
      return parseCursorUsage(
        await apiClient.get<unknown>('/observability/usage/cursor', { signal })
      );
    } catch (error: unknown) {
      const data = isRecord(error) && isRecord(error.data) ? error.data : null;
      const reason =
        data?.code === 'cursor_login_required'
          ? 'login'
          : isRecord(error) && error.status === 403
            ? 'local'
            : 'unavailable';
      throw new CursorUsageError(reason);
    }
  },
};
