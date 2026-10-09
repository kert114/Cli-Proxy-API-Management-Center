import { useEffect, useRef } from 'react';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import { planQuotaAutoLoad } from '../autoLoad';
import type { QuotaFileEntry } from '../logic';
import { QUOTA_ADAPTERS, getQuotaMap } from '../providers';

/** Fetch every credential once when Quota Management opens. No polling. */
export function useQuotaAutoLoad(
  entries: QuotaFileEntry[],
  disabled: boolean,
  loadQuota: (targets: QuotaFileEntry[]) => Promise<void>
) {
  const attempted = useRef(new Set<string>());
  const session = useQuotaStore((state) => state.cacheGeneration);
  const fileGenerations = useQuotaStore((state) => state.fileGenerations);

  useEffect(() => {
    if (disabled) return;
    const loadingKeys = new Set<string>();
    for (const entry of entries) {
      const cacheKey = getQuotaCacheKey(entry.file);
      if (getQuotaMap(QUOTA_ADAPTERS[entry.type])[cacheKey]?.status === 'loading') {
        loadingKeys.add(cacheKey);
      }
    }
    const plan = planQuotaAutoLoad(
      entries,
      attempted.current,
      session,
      fileGenerations,
      loadingKeys
    );
    plan.mark.forEach((key) => attempted.current.add(key));
    if (plan.load.length === 0) return;
    void loadQuota(plan.load);
  }, [disabled, entries, fileGenerations, loadQuota, session]);
}
