import { describe, expect, test } from 'bun:test';
import { computeApiUrl, isLoopbackApiBase, normalizeApiBase } from '../src/utils/connection';
import { resolvePluginAssetURL } from '../src/features/plugins/pluginResources';

describe('v8-only management connections', () => {
  test.each([
    ['localhost:8317', 'http://localhost:8317'],
    [' https://proxy.example/ ', 'https://proxy.example'],
    ['https://proxy.example/v8/management/', 'https://proxy.example'],
    ['https://proxy.example/gateway/v8/management///', 'https://proxy.example/gateway'],
  ])('normalizes %s without changing the deployment prefix', (input, expected) => {
    expect(normalizeApiBase(input)).toBe(expected);
    expect(computeApiUrl(input)).toBe(`${expected}/v8/management`);
  });

  test('does not create a URL for empty input', () => {
    expect(computeApiUrl('  ')).toBe('');
  });

  test('does not silently adapt a legacy management URL', () => {
    expect(normalizeApiBase('https://proxy.example/v0/management')).toBe(
      'https://proxy.example/v0/management'
    );
  });

  test('preserves backend-declared plugin resource and custom extension paths', () => {
    for (const path of ['/v0/resource/plugins/example/index.html', '/v0/management/example']) {
      expect(resolvePluginAssetURL(path, 'https://proxy.example/v8/management')).toBe(
        `https://proxy.example${path}`
      );
    }
  });
});

describe('loopback management connections', () => {
  test.each([
    'http://127.0.0.1:8317',
    'https://[::1]:8317/gateway/v8/management',
    'LOCALHOST:8317',
  ])('accepts a local proxy at %s', (base) => {
    expect(isLoopbackApiBase(base)).toBe(true);
  });

  test.each([
    'https://proxy-review.test',
    'https://localhost.proxy-review.test',
    'http://localhost@proxy-review.test',
    'https://proxy-review.test/127.0.0.1',
    'http://[::2]:8317',
    'https://[',
    '',
  ])('rejects non-loopback or invalid bases (%s)', (base) => {
    expect(isLoopbackApiBase(base)).toBe(false);
  });
});
