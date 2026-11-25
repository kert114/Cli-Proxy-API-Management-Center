import { describe, expect, test } from 'bun:test';
import { parseAgentActivity } from '../src/services/api/agentActivity';
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
