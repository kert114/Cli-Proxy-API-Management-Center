/** Explicit, loopback-only browser fixture. Never imported by the application. */
import type { AxiosInstance } from 'axios';
import { apiClient } from '../../src/services/api/client';
import { useAuthStore, useLanguageStore } from '../../src/stores';
import { statisticsFixture, pullsFixture } from './githubDashboard';

export async function installWorkspaceFixture() {
  if (!['localhost', '127.0.0.1'].includes(location.hostname))
    throw new Error('Local verification only');
  const client = apiClient as unknown as { instance: AxiosInstance };
  const original = client.instance.defaults.adapter;
  const control = {
    requests: [] as {
      url: string;
      section?: string;
      year?: number;
      authIndex?: string;
      upstreamMethod?: string;
      upstreamUrl?: string;
    }[],
    delay: 0,
    fail: false,
    limited: false,
    accounts: 2,
  };
  client.instance.defaults.adapter = async (config) => {
    const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    control.requests.push({
      url: config.url ?? '',
      section: config.params?.section,
      year: config.params?.year,
      authIndex: payload?.authIndex,
      upstreamMethod: payload?.method,
      upstreamUrl: payload?.url,
    });
    if (control.delay) await new Promise((resolve) => setTimeout(resolve, control.delay));
    let data: unknown;
    if (config.url === '/credentials')
      data = {
        files: [
          { name: 'qa-claude.json', type: 'claude', auth_index: 'qa-claude' },
          ...Array.from({ length: control.accounts - 1 }, (_, index) => ({
            name: `qa-codex-${index}.json`,
            type: 'codex',
            auth_index: `qa-codex-${index}`,
          })),
        ],
      };
    else if (config.url === '/config') data = {};
    else if (config.url === '/observability/github/dashboard') {
      if (control.fail) throw { status: 503, message: 'Synthetic unavailable' };
      data =
        config.params.section === 'statistics'
          ? { ...statisticsFixture(config.params.year), limited: control.limited }
          : pullsFixture();
    } else if (config.url === '/observability/usage/cursor') {
      data = {
        plan: 'pro',
        checked_at: new Date().toISOString(),
        resets_at: '2026-11-01T00:00:00Z',
        included: { percent_used: 26 },
        on_demand: { used_usd: 5, limit_kind: 'fixed', limit_usd: 50 },
      };
    } else if (config.url === '/requests/api-call') {
      if (payload.method !== 'GET') throw new Error('Fixture refuses provider mutations');
      let body: unknown;
      if (payload.url.includes('anthropic')) {
        body = payload.url.includes('cedar_ember')
          ? {
              cedar_ember: {
                eligible: true,
                at_limit: true,
                grants: [
                  {
                    id: 'qa-grant',
                    label: 'QA reset grant',
                    resets_total: 3,
                    resets_left: 2,
                    ends_at: '2026-10-31T23:59:00Z',
                    usable_now: true,
                    use_requires_limit: true,
                    clears: ['five_hour'],
                  },
                ],
                next_grant_id: 'qa-grant',
              },
            }
          : payload.url.includes('profile')
            ? { organization: { rate_limit_tier: 'default_claude_max_5x' } }
            : {
                five_hour: { utilization: 82, resets_at: '2026-10-20T12:00:00Z' },
                seven_day: { utilization: 39, resets_at: '2026-10-23T12:00:00Z' },
              };
      } else
        body = payload.url.includes('reset')
          ? {
              available_count: 2,
              credits: [
                {
                  id: 'qa-credit',
                  reset_type: 'codex_rate_limits',
                  status: 'available',
                  expires_at: '2026-10-30T12:00:00Z',
                },
              ],
            }
          : {
              plan_type: 'pro',
              rate_limit: {
                primary_window: {
                  used_percent: 32,
                  limit_window_seconds: 18000,
                  reset_at: 1792497600,
                },
                secondary_window: {
                  used_percent: 58,
                  limit_window_seconds: 604800,
                  reset_at: 1792756800,
                },
              },
            };
      data = { status_code: 200, body, header: {} };
    } else throw { status: 404, message: 'Synthetic API unavailable' };
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  useLanguageStore.getState().setLanguage('en');
  apiClient.setConfig({ apiBase: location.origin, managementKey: 'synthetic-browser-fixture' });
  useAuthStore.setState({
    apiBase: location.origin,
    managementKey: 'synthetic-browser-fixture',
    isAuthenticated: true,
    connectionStatus: 'connected',
  });
  location.hash = '/';
  return {
    control,
    cleanup: () => {
      useAuthStore.getState().logout();
      client.instance.defaults.adapter = original;
    },
  };
}
