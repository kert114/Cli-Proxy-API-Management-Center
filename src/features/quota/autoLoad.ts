import { getQuotaCacheKey } from '@/utils/quota/identity';
import type { QuotaFileEntry } from './logic';

export interface QuotaAutoLoadPlan {
  load: QuotaFileEntry[];
  mark: string[];
}

export function quotaAutoLoadKey(
  entry: QuotaFileEntry,
  session: number,
  fileGeneration: number
): string {
  return JSON.stringify([
    session,
    fileGeneration,
    entry.type,
    entry.file.name,
    entry.file.authIndex,
  ]);
}

/** Credentials to fetch when Quota Management opens. One attempt per session and file revision. */
export function planQuotaAutoLoad(
  entries: readonly QuotaFileEntry[],
  attempted: ReadonlySet<string>,
  session: number,
  fileGenerations: Readonly<Record<string, number>>,
  loadingKeys: ReadonlySet<string>
): QuotaAutoLoadPlan {
  const load: QuotaFileEntry[] = [];
  const mark: string[] = [];
  for (const entry of entries) {
    const key = quotaAutoLoadKey(entry, session, fileGenerations[entry.file.name] ?? 0);
    if (attempted.has(key)) continue;
    mark.push(key);
    if (!loadingKeys.has(getQuotaCacheKey(entry.file))) load.push(entry);
  }
  return { load, mark };
}

/** Keep visit-time refresh inside the same upstream concurrency bound as Refresh all. */
export function chunkQuotaTargets<T>(targets: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('quota auto-load chunk size must be positive');
  }
  const chunks: T[][] = [];
  for (let index = 0; index < targets.length; index += size) {
    chunks.push(targets.slice(index, index + size));
  }
  return chunks;
}

/**
 * Next concurrency-sized slice of one quota batch.
 * An empty chunk means the batch must stop: the session changed, or nothing is left.
 * The rest is not fetched under a newer session.
 */
export function takeQuotaBatchChunk<T>(
  targets: readonly T[],
  size: number,
  sessionAtStart: number,
  sessionNow: number
): { chunk: T[]; rest: T[] } {
  if (sessionAtStart !== sessionNow || targets.length === 0) return { chunk: [], rest: [] };
  const [chunk] = chunkQuotaTargets(targets, size);
  return { chunk, rest: targets.slice(chunk.length) };
}
