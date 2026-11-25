import type { ApiError } from '@/types';
import { isRecord } from '@/utils/helpers';
import { apiClient } from './client';

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
  jobs: { available: boolean; running: ActivityJob[]; queued: ActivityJob[]; reason?: string };
}

export type ActivityResult =
  { status: 'ok'; hosts: ActivityHost[] } | { status: 'unavailable' | 'localOnly' | 'unsupported' };

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

function parseJobs(value: unknown): ActivityJob[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const job = record(item);
    const id = str(job?.job_id);
    return id
      ? [{ id, label: str(job?.label), repo: str(job?.repo), waitReason: str(job?.wait_reason) }]
      : [];
  });
}

export function parseAgentActivity(payload: unknown): ActivityHost[] {
  const hosts = record(payload)?.hosts;
  if (!Array.isArray(hosts)) throw new Error('Invalid agent activity snapshot');
  return hosts.map((value: unknown): ActivityHost => {
    const entry = record(value);
    const snapshot = record(entry?.snapshot);
    const host = str(snapshot?.host);
    const name = str(entry?.alias) ?? str(entry?.name) ?? host ?? str(entry?.host);
    if (!name) throw new Error('Agent activity host is missing a name');

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
    const jobsAvailable = jobs?.status === 'ok';
    const ts = nonnegative(snapshot?.ts);
    return {
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
        available: jobsAvailable,
        queued: jobsAvailable ? parseJobs(jobs?.queued) : [],
        running: jobsAvailable ? parseJobs(jobs?.running) : [],
        reason: str(jobs?.reason),
      },
    };
  });
}

export const agentActivityApi = {
  async snapshot(signal: AbortSignal): Promise<ActivityResult> {
    try {
      const data = await apiClient.get<unknown>('/observability/agent-activity', { signal });
      return { status: 'ok', hosts: parseAgentActivity(data) };
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 503 && apiError.apiCode === 'agent_activity_unavailable') {
        return { status: 'unavailable' };
      }
      if (apiError.apiCode === 'agent_activity_local_only') return { status: 'localOnly' };
      if (apiError.status === 404) return { status: 'unsupported' };
      throw error;
    }
  },
};
