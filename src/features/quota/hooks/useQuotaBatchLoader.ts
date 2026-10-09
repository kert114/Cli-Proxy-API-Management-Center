/**
 * Mixed-provider batch quota loading.
 *
 * Three guards match the previous loader:
 * - loadingRef deduplicates overlapping batches;
 * - requestIdRef drops a response overtaken by a newer batch;
 * - one captured cache generation covers every chunk, and a later chunk does not
 *   start after that session ends.
 * Results commit per provider, so a fast provider does not wait for a slow one.
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { captureQuotaCacheGeneration, commitIfQuotaCacheCurrent, useQuotaStore } from '@/stores';
import { getStatusFromError } from '@/utils/quota';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import { takeQuotaBatchChunk } from '../autoLoad';
import { QUOTA_PAGE_SIZE } from '../constants';
import type { QuotaFileEntry } from '../logic';
import { QUOTA_ADAPTERS, getQuotaSetter, type QuotaCardState } from '../providers';
import { enrichQuotaInBackground } from '../quotaEnrichment';
import type { QuotaProviderType } from '../providers/types';

interface BatchFetchResult {
  name: string;
  cacheKey: string;
  status: 'success' | 'error';
  data?: unknown;
  error?: string;
  errorStatus?: number;
}

export function useQuotaBatchLoader() {
  const { t } = useTranslation();
  const [batchLoading, setBatchLoading] = useState(false);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadQuota = useCallback(
    async (targets: QuotaFileEntry[]) => {
      if (loadingRef.current) return;
      if (targets.length === 0) return;
      loadingRef.current = true;
      const requestId = ++requestIdRef.current;
      const cacheGeneration = captureQuotaCacheGeneration();
      setBatchLoading(true);

      try {
        let rest = targets;
        while (rest.length > 0) {
          const next = takeQuotaBatchChunk(
            rest,
            QUOTA_PAGE_SIZE,
            cacheGeneration.cacheGeneration,
            useQuotaStore.getState().cacheGeneration
          );
          if (next.chunk.length === 0 || requestId !== requestIdRef.current) return;
          rest = next.rest;
          const groups = new Map<QuotaProviderType, QuotaFileEntry[]>();
          next.chunk.forEach((entry) => {
            const group = groups.get(entry.type) ?? [];
            group.push(entry);
            groups.set(entry.type, group);
          });

          await Promise.all(
            Array.from(groups.entries()).map(async ([type, entries]) => {
              const adapter = QUOTA_ADAPTERS[type];
              const setQuota = getQuotaSetter(adapter);

              commitIfQuotaCacheCurrent(cacheGeneration, () => {
                setQuota((prev) => {
                  const nextState = { ...prev };
                  entries.forEach(({ file }) => {
                    nextState[getQuotaCacheKey(file)] = adapter.buildLoadingState();
                  });
                  return nextState;
                });
              });

              const results = await Promise.all(
                entries.map(async ({ file }): Promise<BatchFetchResult> => {
                  const cacheKey = getQuotaCacheKey(file);
                  try {
                    const data = await adapter.fetchQuota(file, t);
                    return { name: file.name, cacheKey, status: 'success', data };
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : t('common.unknown_error');
                    return {
                      name: file.name,
                      cacheKey,
                      status: 'error',
                      error: message,
                      errorStatus: getStatusFromError(err),
                    };
                  }
                })
              );

              if (requestId !== requestIdRef.current) return;

              const committedStates = new Map<string, QuotaCardState>();
              setQuota((prev) => {
                const nextState = { ...prev };
                results.forEach((result) => {
                  commitIfQuotaCacheCurrent(
                    cacheGeneration,
                    () => {
                      nextState[result.cacheKey] =
                        result.status === 'success'
                          ? adapter.buildSuccessState(result.data)
                          : adapter.buildErrorState(
                              result.error || t('common.unknown_error'),
                              result.errorStatus
                            );
                      committedStates.set(result.cacheKey, nextState[result.cacheKey]);
                    },
                    result.name
                  );
                });
                return nextState;
              });
              results.forEach((result, index) => {
                const state = committedStates.get(result.cacheKey);
                if (result.status === 'success' && state) {
                  void enrichQuotaInBackground(adapter, entries[index].file, result.data, state, t);
                }
              });
            })
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setBatchLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [t]
  );

  return { batchLoading, loadQuota };
}
