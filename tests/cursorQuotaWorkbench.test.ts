import { expect, test } from 'bun:test';
import {
  buildTabCounts,
  classifyQuotaFiles,
  filterEntriesBySearch,
  filterEntriesByTab,
  paginate,
  sortQuotaEntries,
} from '@/features/quota/logic';

const cursor = { type: 'cursor' as const, label: 'Cursor CLI account' };
const credentials = classifyQuotaFiles([
  { name: 'claude-demo.json', provider: 'claude' },
  { name: 'codex-demo.json', provider: 'codex' },
]);
const accounts = [...credentials, cursor];

test('counts the Cursor account together with the other providers', () => {
  expect(buildTabCounts(accounts)).toMatchObject({ all: 3, claude: 1, codex: 1, cursor: 1 });
});

test('finds Cursor through the same provider and account search controls', () => {
  expect(filterEntriesBySearch(filterEntriesByTab(accounts, 'all'), ' CURSOR ')).toEqual([cursor]);
  expect(filterEntriesBySearch(filterEntriesByTab(accounts, 'cursor'), 'CLI account')).toEqual([
    cursor,
  ]);
  expect(filterEntriesBySearch(filterEntriesByTab(accounts, 'codex'), 'cursor')).toEqual([]);
  expect(filterEntriesBySearch(accounts, 'missing')).toEqual([]);
});

test('sorts and paginates Cursor with the other accounts without changing refresh targets', () => {
  const ordered = sortQuotaEntries(accounts, 'soonest', (entry) =>
    entry.type === 'cursor' ? 100 : null
  );
  expect(paginate(ordered, 1, 2).pageItems).toEqual([cursor, credentials[0]]);
  expect(paginate(ordered, 2, 2).pageItems).toEqual([credentials[1]]);
  expect(ordered.filter((entry) => entry.type !== 'cursor')).toEqual(credentials);
  expect(accounts).toEqual([...credentials, cursor]);
});

test('searches all providers by name even when their filenames omit the provider', () => {
  const entries = classifyQuotaFiles([{ name: 'personal.json', provider: 'codex' }]);
  expect(filterEntriesBySearch(entries, ' CODEX ')).toEqual(entries);
});
