export class DashboardCache<T> {
  private entries = new Map<string, { data: T; fetchedAt: number }>();
  private failed = new Set<string>();
  private pending = new Map<string, { controller: AbortController; promise: Promise<T> }>();
  constructor(private now: () => number = Date.now) {}
  read(key: string): T | undefined {
    return this.entries.get(key)?.data;
  }
  age(key: string): number {
    const entry = this.entries.get(key);
    return entry ? this.now() - entry.fetchedAt : Infinity;
  }
  load(
    key: string,
    ttl: number,
    fetcher: (signal: AbortSignal) => Promise<T>,
    force = false
  ): Promise<T> {
    const pending = this.pending.get(key);
    if (pending) return pending.promise;
    const entry = this.entries.get(key);
    if (entry && !this.failed.has(key) && this.age(key) < (force ? 15000 : ttl))
      return Promise.resolve(entry.data);
    const controller = new AbortController();
    const promise = fetcher(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) throw new Error('GitHub dashboard session changed');
        this.entries.set(key, { data, fetchedAt: this.now() });
        this.failed.delete(key);
        return data;
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) this.failed.add(key);
        throw error;
      })
      .finally(() => {
        if (this.pending.get(key)?.controller === controller) this.pending.delete(key);
      });
    this.pending.set(key, { controller, promise });
    return promise;
  }
  invalidate() {
    this.pending.forEach(({ controller }) => controller.abort());
    this.pending.clear();
    this.entries.clear();
    this.failed.clear();
  }
}
