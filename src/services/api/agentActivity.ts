import type { ApiError } from '@/types';
import { isRecord } from '@/utils/helpers';
import { apiCallApi, type ApiCallResult } from './apiCall';

const SNAPSHOT_URL = 'http://127.0.0.1:8765/api/snapshot';
const SNAPSHOT_TIMEOUT_MS = 15_000;

export const AGENT_STATES = [
  'queued',
  'preparing',
  'starting',
  'running',
  'waiting',
  'waiting_for_children',
] as const;

type AgentState = (typeof AGENT_STATES)[number];

export interface ActivityMetric {
  percent?: number;
  cores?: number;
  usedBytes?: number;
  totalBytes?: number;
  reason?: string;
}

interface Pressure {
  load?: number;
  memory?: { level: number } | { someAvg10: number; fullAvg10: number };
  memoryReason?: string;
}

interface ActivityJob {
  id: string;
  label?: string;
  repo?: string;
  waitReason?: string;
}

export interface ActivityHost {
  name: string;
  host?: string;
  os?: string;
  sampledAt?: number;
  stale: boolean;
  unavailable: boolean;
  reason?: string;
  hasSnapshot: boolean;
  cpu: ActivityMetric;
  memory: ActivityMetric;
  swap: ActivityMetric;
  disk: ActivityMetric;
  pressure?: Pressure;
  agents: { counts?: Partial<Record<AgentState, number>>; reason?: string };
  jobs: { running?: ActivityJob[]; queued?: ActivityJob[]; reason?: string };
}

export type ActivityResult =
  | { status: 'ok'; hosts: ActivityHost[] }
  | { status: 'httpError' | 'managementError'; statusCode: number }
  | { status: 'unreachable' | 'invalidSnapshot' | 'timeout' | 'connectionError' };

const record = (value: unknown) => (isRecord(value) ? value : undefined);

const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
const nonnegative = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

function parseMetric(value: unknown): ActivityMetric {
  const section = record(value);
  if (section?.status !== 'ok') return { reason: str(section?.reason) };
  const busy = nonnegative(section.busy_percent);
  if (busy !== undefined)
    return { percent: Math.min(100, busy), cores: nonnegative(section.cores) };
  const used = nonnegative(section.used_bytes);
  const total = nonnegative(section.total_bytes);
  if (used === undefined || total === undefined) return {};
  return {
    usedBytes: used,
    totalBytes: total,
    percent: total ? Math.min(100, (used / total) * 100) : 0,
  };
}

function parsePressure(value: unknown): Pressure | undefined {
  const section = record(value);
  if (!section) return undefined;
  if (section.status !== 'ok') return { memoryReason: str(section.reason) };
  const memory = record(section.memory);
  const level = nonnegative(memory?.level);
  const some = nonnegative(memory?.some_avg10);
  const full = nonnegative(memory?.full_avg10);
  return {
    load: Array.isArray(section.load_average) ? nonnegative(section.load_average[0]) : undefined,
    memory:
      level !== undefined
        ? { level }
        : some !== undefined && full !== undefined
          ? { someAvg10: some, fullAvg10: full }
          : undefined,
    memoryReason: str(section.memory_reason),
  };
}

function parseJobs(value: unknown): ActivityJob[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const jobs = value.flatMap((item: unknown) => {
    const job = record(item);
    const id = str(job?.job_id);
    return id
      ? [{ id, label: str(job?.label), repo: str(job?.repo), waitReason: str(job?.wait_reason) }]
      : [];
  });
  return jobs.length > 0 || value.length === 0 ? jobs : undefined;
}

export function parseAgentActivity(payload: unknown): ActivityHost[] {
  const hosts = record(payload)?.hosts;
  if (!Array.isArray(hosts)) throw new Error('Invalid agent activity snapshot');
  const parsedHosts: ActivityHost[] = [];
  for (const value of hosts) {
    const entry = record(value);
    const snapshot = record(entry?.snapshot);
    const host = str(snapshot?.host);
    const name = str(entry?.alias) ?? str(entry?.name) ?? host ?? str(entry?.host);
    if (!name) continue;

    const agents = record(snapshot?.agents);
    const rawCounts = agents?.status === 'ok' ? record(agents.counts) : undefined;
    const counts: Partial<Record<AgentState, number>> | undefined = rawCounts ? {} : undefined;
    if (counts) {
      for (const state of AGENT_STATES) {
        const count = nonnegative(rawCounts?.[state]);
        if (count !== undefined) counts[state] = count;
      }
    }
    const jobs = record(snapshot?.jobs);
    const ts = nonnegative(snapshot?.ts);
    parsedHosts.push({
      name,
      host,
      os: str(snapshot?.os),
      sampledAt: ts !== undefined && ts < 8.64e12 ? ts * 1000 : undefined,
      stale: entry?.stale === true || entry?.status === 'stale',
      unavailable: entry?.status === 'unavailable' || !snapshot,
      reason: str(entry?.reason),
      hasSnapshot: !!snapshot,
      cpu: parseMetric(snapshot?.cpu),
      memory: parseMetric(snapshot?.memory),
      swap: parseMetric(snapshot?.swap),
      disk: parseMetric(snapshot?.disk),
      pressure: parsePressure(snapshot?.pressure),
      agents: { counts, reason: str(agents?.reason) },
      jobs: {
        queued: jobs?.status === 'ok' ? parseJobs(jobs.queued) : undefined,
        running: jobs?.status === 'ok' ? parseJobs(jobs.running) : undefined,
        reason: str(jobs?.reason),
      },
    });
  }
  return parsedHosts;
}

export const agentActivityApi = {
  async snapshot(signal: AbortSignal): Promise<ActivityResult> {
    let response: ApiCallResult;
    try {
      response = await apiCallApi.request(
        { method: 'GET', url: SNAPSHOT_URL, proxy_url: 'direct' },
        { signal, timeout: SNAPSHOT_TIMEOUT_MS }
      );
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 502 && apiError.apiCode === 'request failed') {
        return { status: 'unreachable' };
      }
      if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
        return { status: 'timeout' };
      }
      if (apiError.status) return { status: 'managementError', statusCode: apiError.status };
      return { status: 'connectionError' };
    }

    if (!response.statusCode) return { status: 'invalidSnapshot' };
    if (response.statusCode !== 200) {
      return { status: 'httpError', statusCode: response.statusCode };
    }
    try {
      return { status: 'ok', hosts: parseAgentActivity(response.body) };
    } catch {
      return { status: 'invalidSnapshot' };
    }
  },
};
