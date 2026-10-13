import {
  gitHubActivityPayload,
  parseGitHubActivity,
  type GitHubActivity,
} from '@/services/api/githubActivity';
const STORAGE_KEY = 'cliproxy.github.snapshots.v1';
const MAX_BYTES = 1_000_000;
const MAX_AGE = 24 * 60 * 60 * 1000;
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type ExpectedScope = { account: string; organization: string };
type Entry = { key: string; savedAt: number; payload: unknown };
export class ActivitySnapshotCache {
  private entries: Entry[] = [];
  private generation = 0;
  private pending = new Map<string, Promise<GitHubActivity>>();
  constructor(private storage?: StoragePort) {
    try {
      const serialized = storage?.getItem(STORAGE_KEY);
      if (!serialized || serialized.length > MAX_BYTES) return;
      const stored: unknown = JSON.parse(serialized);
      if (!Array.isArray(stored)) return;
      this.entries = stored.slice(0, 4).flatMap((row: unknown) => {
        if (
          row &&
          typeof row === 'object' &&
          'key' in row &&
          typeof row.key === 'string' &&
          'savedAt' in row &&
          typeof row.savedAt === 'number' &&
          Number.isFinite(row.savedAt) &&
          row.savedAt <= Date.now() &&
          Date.now() - row.savedAt < MAX_AGE &&
          'payload' in row
        ) {
          return [{ key: row.key, savedAt: row.savedAt, payload: row.payload }];
        }
        return [];
      });
    } catch {
      /* Storage is optional; the in-memory snapshot remains usable. */
    }
  }
  read(key: string, expected: ExpectedScope): GitHubActivity | undefined {
    const entry = this.entries.find((row) => row.key === key && Date.now() - row.savedAt < MAX_AGE);
    if (!entry) return undefined;
    try {
      return parseGitHubActivity(entry.payload, expected);
    } catch {
      return undefined;
    }
  }
  invalidate() {
    this.generation++;
    this.entries = [];
    this.pending.clear();
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      /* Session isolation also holds in memory. */
    }
  }
  refresh(
    key: string,
    expected: ExpectedScope,
    load: () => Promise<GitHubActivity>
  ): Promise<GitHubActivity> {
    const existing = this.pending.get(key);
    if (existing) return existing;
    const generation = this.generation;
    const request = load()
      .then((data) => {
        if (generation !== this.generation) throw new Error('GitHub session changed');
        const payload = gitHubActivityPayload(data);
        parseGitHubActivity(payload, expected);
        this.entries = [
          { key, savedAt: Date.now(), payload },
          ...this.entries.filter((row) => row.key !== key),
        ].slice(0, 4);
        try {
          const serialized = JSON.stringify(this.entries);
          if (serialized.length <= MAX_BYTES) this.storage?.setItem(STORAGE_KEY, serialized);
          else this.storage?.removeItem(STORAGE_KEY);
        } catch {
          /* Browser storage limits do not prevent live rendering. */
        }
        return data;
      })
      .finally(() => {
        if (this.pending.get(key) === request) this.pending.delete(key);
      });
    this.pending.set(key, request);
    return request;
  }
}
