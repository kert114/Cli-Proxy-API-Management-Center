import { expect, test } from 'bun:test';
import { activitySessionScope } from '../src/features/dashboard/activity/session';

test('snapshot identity is opaque, stable in a session, and changes with server or credentials', () => {
  const first = activitySessionScope('http://localhost:8317', 'fixture-only-management-key');
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(first).not.toContain('fixture-only-management-key');
  expect(activitySessionScope('http://localhost:8317', 'fixture-only-management-key')).toBe(first);
  expect(activitySessionScope('http://localhost:8318', 'fixture-only-management-key')).not.toBe(
    first
  );
  expect(activitySessionScope('http://localhost:8317', 'another-fixture-only-key')).not.toBe(first);
});
