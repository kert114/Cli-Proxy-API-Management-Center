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
    expect(mac.jobs.queued[0]).toMatchObject({
      label: 'bun run verify',
      repo: 'sample-panel',
      waitReason: 'memory pressure',
    });
    expect(mac.jobs.running[0].label).toBe('go test ./...');
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

test('recognizes the dashboard outage through the authenticated v8 client', async () => {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      expect(new URL(request.url).pathname).toBe('/v8/management/observability/agent-activity');
      expect(request.headers.get('Authorization')).toBe('Bearer synthetic-api-fixture');
      return Response.json(
        {
          error: 'agent_activity_unavailable',
          message: 'Agent activity dashboard is unavailable.',
        },
        { status: 503 }
      );
    },
  });

  try {
    apiClient.setConfig({ apiBase: server.url.origin, managementKey: 'synthetic-api-fixture' });
    expect(await agentActivityApi.snapshot(new AbortController().signal)).toEqual({
      status: 'unavailable',
    });
  } finally {
    server.stop(true);
    apiClient.setConfig({ apiBase: '', managementKey: '' });
  }
});
