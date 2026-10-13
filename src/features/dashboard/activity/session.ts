import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { useAuthStore } from '@/stores';
import { ActivitySnapshotCache } from './snapshotCache';

export const PREFERENCES_KEY = 'cliproxy.github.preferences.v1';
const SALT_KEY = 'cliproxy.github.session.v1';
let fallbackSalt: string | undefined;
function browserStorage(): Storage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}
export const activitySnapshots = new ActivitySnapshotCache(browserStorage());

/** A per-tab salt makes the authorization fingerprint opaque and nonportable. */
export function activitySessionScope(apiBase: string, managementKey: string): string {
  let salt = fallbackSalt;
  try {
    salt = sessionStorage.getItem(SALT_KEY) || salt;
  } catch {
    /* Session-only fallback. */
  }
  if (!salt) salt = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  fallbackSalt = salt;
  try {
    sessionStorage.setItem(SALT_KEY, salt);
  } catch {
    /* Persistence is optional. */
  }
  return bytesToHex(
    hmac(sha256, utf8ToBytes(salt), utf8ToBytes(JSON.stringify([apiBase, managementKey])))
  );
}
useAuthStore.subscribe((state, previous) => {
  if (
    state.apiBase !== previous.apiBase ||
    state.managementKey !== previous.managementKey ||
    (previous.isAuthenticated && !state.isAuthenticated) ||
    (previous.connectionStatus === 'connected' && state.connectionStatus === 'connecting')
  ) {
    activitySnapshots.invalidate();
    try {
      localStorage.removeItem(PREFERENCES_KEY);
    } catch {
      /* No storage access. */
    }
    // Keep the tab salt on successful login restoration; logout retires it.
    if (!state.isAuthenticated && !state.managementKey) {
      fallbackSalt = undefined;
      try {
        sessionStorage.removeItem(SALT_KEY);
      } catch {
        /* No storage access. */
      }
    }
  }
});
