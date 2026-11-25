import { describe, expect, test } from 'bun:test';
import { agentActivityApi, parseAgentActivity } from '../src/services/api/agentActivity';
import { apiClient } from '../src/services/api/client';
import fixture from './fixtures/agent-activity.json';

describe('agent activity snapshot', () => {
  test('normalizes host metrics, activity counts and queued job reasons', () => {
    const [mac, vm, spare] = parseAgentActivity(fixture);
    expect(mac.name).toBe('workstation');
    expect(mac.cpu).toMatchObject({ percent: 42.5, cores: 12 });
    expect(mac.memory.percent).toBe(75);
    expect(mac.swap.percent).toBe(0);
    expect(mac.pressure?.memory).toEqual({ level: 4 });
    expect(mac.agents.counts?.waiting_for_children).toBe(1);
    expect(mac.jobs.queued?.[0]).toMatchObject({
      label: 'bun run verify',
      repo: 'sample-panel',
      waitReason: 'memory pressure',
    });
    expect(mac.jobs.running?.[0].label).toBe('go test ./...');
    expect(vm.host).toBe('build-vm.local');
    expect(vm.pressure?.memory).toEqual({ someAvg10: 2.47, fullAvg10: 0.38 });
    expect(spare).toMatchObject({
      name: 'spare-vm',
      reason: 'SSH snapshot timed out',
      hasSnapshot: false,
    });
  });
});

test('keeps the last sample and marks unavailable sections without inventing usage', () => {
  const { snapshot } = fixture.hosts[0];
  const [host] = parseAgentActivity({
    hosts: [
      {
        alias: 'workstation',
        status: 'unavailable',
        stale: true,
        reason: 'SSH snapshot timed out',
        snapshot: { ...snapshot, memory: { status: 'unavailable', reason: 'Cannot read memory' } },
      },
    ],
  });
  expect(host).toMatchObject({ stale: true, unavailable: true, hasSnapshot: true });
  expect(host.memory).toEqual({ reason: 'Cannot read memory' });
  expect(host.cpu.percent).toBe(42.5);
});

test('rejects a response without a hosts array', () => {
  expect(() => parseAgentActivity({ status: 'ok' })).toThrow();
});

test('keeps usable hosts when some snapshot sections or host entries are missing', () => {
  const hosts = parseAgentActivity({
    hosts: [
      {
        status: 'ok',
        snapshot: {
          host: 'partial-host',
          agents: { status: 'ok', counts: { running: 2, queued: null } },
          cpu: { status: 'ok', busy_percent: 25 },
          jobs: { status: 'ok', queued: [{ job_id: 'waiting-1', wait_reason: 'CPU load' }] },
        },
      },
      null,
      { alias: 'other-host', snapshot: { jobs: { status: 'ok', recent: [] } } },
    ],
  });
  expect(hosts).toHaveLength(2);
  expect(hosts[0]).toMatchObject({
    name: 'partial-host',
    agents: { counts: { running: 2 } },
    cpu: { percent: 25 },
    jobs: { queued: [{ id: 'waiting-1', waitReason: 'CPU load' }] },
  });
  expect(hosts[0].agents.counts?.queued).toBeUndefined();
  expect(hosts[0].memory.percent).toBeUndefined();
  expect(hosts[0].jobs.running).toBeUndefined();
  expect(hosts[1].jobs.queued).toBeUndefined();
  expect(hosts[1].jobs.running).toBeUndefined();
});

test('distinguishes empty job lists from missing or invalid lists', () => {
  const definitions = [
    { status: 'ok', queued: [] },
    { status: 'ok', running: [], queued: [] },
    { status: 'ok', running: [{ job_id: 'running-1' }], queued: [{}] },
    { status: 'unavailable', running: [], queued: [], reason: 'Job directory unavailable' },
  ];
  const [queuedOnly, bothEmpty, runningOnly, unavailable] = parseAgentActivity({
    hosts: definitions.map((jobs, index) => ({ alias: `host-${index}`, snapshot: { jobs } })),
  });

  expect(queuedOnly.jobs.queued).toEqual([]);
  expect(queuedOnly.jobs.running).toBeUndefined();
  expect(bothEmpty.jobs).toMatchObject({ running: [], queued: [] });
  expect(runningOnly.jobs.running).toMatchObject([{ id: 'running-1' }]);
  expect(runningOnly.jobs.queued).toBeUndefined();
  expect(unavailable.jobs).toEqual({
    running: undefined,
    queued: undefined,
    reason: 'Job directory unavailable',
  });
});

test('fetches the fixed loopback snapshot through the authenticated v8 API call', async () => {
  const requests: unknown[] = [];
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      requests.push({
        path: new URL(request.url).pathname,
        method: request.method,
        authorization: request.headers.get('Authorization'),
        payload: request.method === 'POST' ? await request.json() : null,
      });
      return Response.json({ status_code: 200, header: {}, body: JSON.stringify(fixture) });
    },
  });

  try {
    apiClient.setConfig({ apiBase: server.url.origin, managementKey: 'synthetic-api-fixture' });
    const result = await agentActivityApi.snapshot(new AbortController().signal);
    expect(requests).toEqual([
      {
        path: '/v8/management/requests/api-call',
        method: 'POST',
        authorization: 'Bearer synthetic-api-fixture',
        payload: { method: 'GET', url: 'http://127.0.0.1:8765/api/snapshot', proxy_url: 'direct' },
      },
    ]);
    expect(result).toMatchObject({
      status: 'ok',
      hosts: [{ name: 'workstation' }, { name: 'build-vm' }, { name: 'spare-vm' }],
    });
  } finally {
    server.stop(true);
    apiClient.setConfig({ apiBase: '', managementKey: '' });
  }
});

const snapshotEnvelope = (statusCode: number, body: string) => () =>
  Response.json({ status_code: statusCode, header: {}, body });

test.each([
  {
    name: 'dashboard connection failure',
    respond: () => Response.json({ error: 'request failed' }, { status: 502 }),
    expected: { status: 'unreachable' },
  },
  {
    name: 'non-200 dashboard response',
    respond: snapshotEnvelope(503, JSON.stringify(fixture)),
    expected: { status: 'httpError', statusCode: 503 },
  },
  {
    name: 'invalid dashboard JSON',
    respond: snapshotEnvelope(200, '{broken'),
    expected: { status: 'invalidSnapshot' },
  },
  {
    name: 'invalid snapshot shape',
    respond: snapshotEnvelope(200, '{}'),
    expected: { status: 'invalidSnapshot' },
  },
  {
    name: 'management API failure',
    respond: () => Response.json({ error: 'forbidden' }, { status: 403 }),
    expected: { status: 'managementError', statusCode: 403 },
  },
])('reports an outage for $name', async ({ respond, expected }) => {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: respond });
  try {
    apiClient.setConfig({ apiBase: server.url.origin, managementKey: 'synthetic-api-fixture' });
    expect(await agentActivityApi.snapshot(new AbortController().signal)).toEqual(expected);
  } finally {
    server.stop(true);
    apiClient.setConfig({ apiBase: '', managementKey: '' });
  }
});
