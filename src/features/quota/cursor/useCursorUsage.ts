import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/api/client';
import {
  CursorUsageError,
  cursorUsageApi,
  type CursorUsageSnapshot,
} from '@/services/api/cursorUsage';
import { useAuthStore } from '@/stores/useAuthStore';
import { useQuotaStore } from '@/stores/useQuotaStore';

export type CursorUsageState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; snapshot: CursorUsageSnapshot }
  | { status: 'error'; reason: 'login' | 'local' | 'unavailable' };

export function useCursorUsage() {
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const generation = useQuotaStore((state) => state.cacheGeneration);
  const request = useRef<AbortController | null>(null);
  const [result, setResult] = useState<{
    generation: number;
    revision: number;
    state: CursorUsageState;
  } | null>(null);

  const refresh = useCallback(async () => {
    request.current?.abort();
    if (connectionStatus !== 'connected') {
      setResult(null);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const revision = apiClient.getConnectionRevision();
    const isCurrent = () =>
      request.current === controller &&
      !controller.signal.aborted &&
      revision === apiClient.getConnectionRevision() &&
      generation === useQuotaStore.getState().cacheGeneration &&
      apiBase === useAuthStore.getState().apiBase &&
      managementKey === useAuthStore.getState().managementKey &&
      useAuthStore.getState().connectionStatus === 'connected';
    setResult({ generation, revision, state: { status: 'loading' } });
    try {
      const snapshot = await cursorUsageApi.get(controller.signal);
      if (isCurrent()) setResult({ generation, revision, state: { status: 'success', snapshot } });
    } catch (error: unknown) {
      if (!isCurrent()) return;
      const reason = error instanceof CursorUsageError ? error.reason : 'unavailable';
      setResult({ generation, revision, state: { status: 'error', reason } });
    }
  }, [connectionStatus, apiBase, managementKey, generation]);

  useEffect(() => {
    void refresh();
    return () => {
      request.current?.abort();
    };
  }, [refresh]);

  const state: CursorUsageState =
    connectionStatus === 'connected' &&
    result?.generation === generation &&
    result.revision === apiClient.getConnectionRevision()
      ? result.state
      : { status: 'idle' };
  return { state, refresh };
}
