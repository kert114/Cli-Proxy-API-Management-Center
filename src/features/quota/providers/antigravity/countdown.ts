const MINUTE_MS = 60_000;

/** Wait until the countdown drops below a whole minute or reaches the reset. */
export function getNextAntigravityCountdownUpdateDelay(
  resetTimestamps: readonly number[],
  nowMs: number
): number | null {
  let nextDelay: number | null = null;

  resetTimestamps.forEach((resetMs) => {
    if (!Number.isFinite(resetMs)) return;
    const deltaMs = resetMs - nowMs;
    if (deltaMs <= 0) return;

    const remainder = deltaMs % MINUTE_MS;
    const delay = Math.min(deltaMs, remainder + 1);
    nextDelay = nextDelay === null ? delay : Math.min(nextDelay, delay);
  });

  return nextDelay;
}
