import { expect, test } from 'bun:test';
import { classifyQuotaFiles } from '@/features/quota/logic';
import {
  chunkQuotaTargets,
  planQuotaAutoLoad,
  takeQuotaBatchChunk,
} from '@/features/quota/autoLoad';

const entries = classifyQuotaFiles([
  { name: 'claude-demo.json', provider: 'claude' },
  { name: 'codex-demo.json', provider: 'codex' },
  { name: 'devin-demo.json', provider: 'devin' },
]);

test('loads every provider when the quota page opens, not only Devin', () => {
  const plan = planQuotaAutoLoad(entries, new Set(), 4, {}, new Set());

  expect(plan.load.map((entry) => entry.file.name)).toEqual([
    'claude-demo.json',
    'codex-demo.json',
    'devin-demo.json',
  ]);
  expect(plan.mark).toHaveLength(3);
});

test('leaves an in-flight credential to that refresh and still records the visit', () => {
  const plan = planQuotaAutoLoad(entries, new Set(), 4, {}, new Set(['codex-demo.json']));

  expect(plan.load.map((entry) => entry.file.name)).toEqual([
    'claude-demo.json',
    'devin-demo.json',
  ]);
  expect(plan.mark).toHaveLength(3);
});

test('does not fetch a credential again after this visit already started it', () => {
  const first = planQuotaAutoLoad(entries, new Set(), 4, {}, new Set());
  const second = planQuotaAutoLoad(entries, new Set(first.mark), 4, {}, new Set());

  expect(second.load).toEqual([]);
  expect(second.mark).toEqual([]);
});

test('refreshes more than one page without exceeding the refresh-all batch size', () => {
  const plan = planQuotaAutoLoad(entries, new Set(), 4, {}, new Set());
  expect(
    chunkQuotaTargets(plan.load, 2).map((chunk) => chunk.map((entry) => entry.file.name))
  ).toEqual([['claude-demo.json', 'codex-demo.json'], ['devin-demo.json']]);
});

test('does not start the next batch after the quota session has changed', () => {
  const names = entries.map((entry) => entry.file.name);
  const first = takeQuotaBatchChunk(names, 2, 4, 4);
  expect(first).toEqual({
    chunk: ['claude-demo.json', 'codex-demo.json'],
    rest: ['devin-demo.json'],
  });
  expect(takeQuotaBatchChunk(first.rest, 2, 4, 5)).toEqual({ chunk: [], rest: [] });
});
