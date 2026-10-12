import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { IconGithub, IconRefreshCw } from '@/components/ui/icons';
import { useAuthStore, useQuotaStore } from '@/stores';
import { useNow } from '@/hooks/useNow';
import { githubActivityApi, type GitHubActivity as Activity } from '@/services/api/githubActivity';
import { activityWindow, type ActivityPeriod } from './window';
import styles from './GitHubActivity.module.scss';

const DEFAULT_REPOSITORY = 'kert114/CLIProxyAPI';
const repositoryPattern = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/;

type LoadState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'error'; reason: 'local' | 'backend' | 'unavailable' }
  | { key: string; status: 'success'; data: Activity };

const checkLabel = (checks: string) =>
  checks === 'SUCCESS'
    ? 'checks_passed'
    : checks === 'FAILURE' || checks === 'ERROR'
      ? 'checks_failed'
      : checks === 'PENDING' || checks === 'EXPECTED'
        ? 'checks_pending'
        : 'checks_none';
const reviewLabel = (review: string) =>
  review === 'APPROVED'
    ? 'approved'
    : review === 'CHANGES_REQUESTED'
      ? 'changes_requested'
      : review === 'REVIEW_REQUIRED'
        ? 'review_required'
        : 'review_none';

export function GitHubActivityPanel({
  data,
  period,
  window,
}: {
  data: Activity;
  period: ActivityPeriod;
  window: { since: string; until: string };
}) {
  const { t, i18n } = useTranslation();
  const [activityTab, setActivityTab] = useState<'prs' | 'commits'>('prs');
  const range = `${window.since}..${new Date(Date.parse(window.until) - 1000).toISOString()}`;
  const searchURL = (filter: string) =>
    `${data.url}/pulls?q=${encodeURIComponent(`is:pr ${filter}:${range}`)}`;
  const metrics = [
    { label: t('work_dashboard.open_prs'), count: data.openCount, url: `${data.url}/pulls` },
    {
      label: t(`work_dashboard.created_${period}`),
      count: data.createdCount,
      url: searchURL('created'),
    },
    {
      label: t(`work_dashboard.merged_${period}`),
      count: data.mergedCount,
      url: searchURL('merged'),
    },
    {
      label: t(`work_dashboard.commits_${period}`),
      count: data.commitCount,
      url: `${data.url}/commits/${encodeURIComponent(data.defaultBranch)}?${new URLSearchParams({ since: window.since, until: new Date(Date.parse(window.until) - 1000).toISOString() })}`,
    },
  ];
  const date = (value: string) =>
    new Date(value).toLocaleString(i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const shown = (visible: number, total: number) =>
    visible < total && (
      <p className={styles.note}>{t('work_dashboard.showing', { visible, total })}</p>
    );

  return (
    <>
      <div className={styles.metrics}>
        {metrics.map((metric) => (
          <a
            key={metric.label}
            className={styles.metric}
            href={metric.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>{metric.label}</span>
            <strong>{metric.count.toLocaleString()}</strong>
          </a>
        ))}
      </div>
      <p className={styles.note}>
        {t('work_dashboard.scope', { branch: data.defaultBranch || t('work_dashboard.no_branch') })}
      </p>
      <div className={styles.columns}>
        <Card
          title={t('work_dashboard.open_prs')}
          extra={<span className={styles.count}>{data.openCount}</span>}
        >
          {data.openPRs.length === 0 ? (
            <p className={styles.empty}>{t('work_dashboard.no_open_prs')}</p>
          ) : (
            <ul className={styles.list}>
              {data.openPRs.map((pr) => (
                <li key={pr.number}>
                  <a className={styles.row} href={pr.url} target="_blank" rel="noopener noreferrer">
                    <div className={styles.rowTitle}>
                      <span className={styles.number}>#{pr.number}</span>
                      <strong>{pr.title}</strong>
                    </div>
                    <span className={styles.meta}>
                      {pr.author || t('work_dashboard.unknown_author')}
                      {pr.draft && ` · ${t('work_dashboard.draft')}`}
                    </span>
                    <div className={styles.badges}>
                      <span
                        className={
                          pr.checks === 'SUCCESS'
                            ? styles.good
                            : pr.checks === 'FAILURE' || pr.checks === 'ERROR'
                              ? styles.bad
                              : styles.neutral
                        }
                      >
                        {t(`work_dashboard.${checkLabel(pr.checks)}`)}
                      </span>
                      <span
                        className={
                          pr.review === 'APPROVED'
                            ? styles.good
                            : pr.review === 'CHANGES_REQUESTED'
                              ? styles.bad
                              : styles.neutral
                        }
                      >
                        {t(`work_dashboard.${reviewLabel(pr.review)}`)}
                      </span>
                      {pr.mergeable === 'CONFLICTING' && (
                        <span className={styles.bad}>{t('work_dashboard.conflicts')}</span>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {shown(data.openPRs.length, data.openCount)}
        </Card>
        <Card
          title={t(`work_dashboard.activity_${period}`)}
          extra={
            <div
              className={styles.toggle}
              role="group"
              aria-label={t('work_dashboard.activity_type')}
            >
              <Button
                variant={activityTab === 'prs' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={activityTab === 'prs'}
                onClick={() => setActivityTab('prs')}
              >
                {t('work_dashboard.prs')}
              </Button>
              <Button
                variant={activityTab === 'commits' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={activityTab === 'commits'}
                onClick={() => setActivityTab('commits')}
              >
                {t('work_dashboard.commits')}
              </Button>
            </div>
          }
        >
          {activityTab === 'prs' ? (
            <>
              {data.createdPRs.length === 0 ? (
                <p className={styles.empty}>{t('work_dashboard.no_created_prs')}</p>
              ) : (
                <ul className={styles.list}>
                  {data.createdPRs.map((pr) => (
                    <li key={pr.number}>
                      <a
                        className={styles.row}
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className={styles.rowTitle}>
                          <span className={styles.number}>#{pr.number}</span>
                          <strong>{pr.title}</strong>
                        </div>
                        <span className={styles.meta}>
                          {t(`work_dashboard.state_${pr.state.toLowerCase()}`, {
                            defaultValue: pr.state,
                          })}{' '}
                          · {date(pr.createdAt)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {shown(data.createdPRs.length, data.createdCount)}
            </>
          ) : (
            <>
              {data.commits.length === 0 ? (
                <p className={styles.empty}>{t('work_dashboard.no_commits')}</p>
              ) : (
                <ul className={styles.list}>
                  {data.commits.map((commit) => (
                    <li key={commit.sha}>
                      <a
                        className={styles.row}
                        href={commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className={styles.rowTitle}>
                          <span className={styles.number}>{commit.sha.slice(0, 7)}</span>
                          <strong>{commit.title}</strong>
                        </div>
                        <span className={styles.meta}>
                          {commit.author} · {date(commit.date)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {shown(data.commits.length, data.commitCount)}
            </>
          )}
        </Card>
      </div>
    </>
  );
}

export function GitHubActivity({ refreshToken = 0 }: { refreshToken?: number }) {
  const { t, i18n } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const connected = useAuthStore((state) => state.connectionStatus === 'connected');
  const session = useQuotaStore((state) => state.cacheGeneration);
  const [repository, setRepository] = useState(DEFAULT_REPOSITORY);
  const [draftRepository, setDraftRepository] = useState(DEFAULT_REPOSITORY);
  const [editing, setEditing] = useState(false);
  const [invalidRepository, setInvalidRepository] = useState(false);
  const [period, setPeriod] = useState<ActivityPeriod>('week');
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);
  const now = useNow();
  const window = useMemo(() => activityWindow(period, new Date(now)), [period, now]);
  const { since, until } = window;
  const key = JSON.stringify([
    apiBase,
    session,
    repository,
    period,
    window.since,
    refresh,
    refreshToken,
  ]);

  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    setState({ key, status: 'loading' });
    void githubActivityApi.get(repository, { since, until }, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ key, status: 'success', data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const status =
          error !== null && typeof error === 'object' && 'status' in error ? error.status : null;
        setState({
          key,
          status: 'error',
          reason: status === 403 ? 'local' : status === 404 ? 'backend' : 'unavailable',
        });
      }
    );
    return () => controller.abort();
    // Calendar boundaries are stable between minute ticks.
  }, [connected, key, repository, since, until]);

  const current = connected && state?.key === key ? state : null;
  const loading = connected && (!current || current.status === 'loading');
  return (
    <section className={styles.section} aria-label={t('work_dashboard.github')}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <IconGithub size={24} />
          <div>
            <h2>{t('work_dashboard.github')}</h2>
            <a href={`https://github.com/${repository}`} target="_blank" rel="noopener noreferrer">
              {repository}
            </a>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(!editing);
              setDraftRepository(repository);
              setInvalidRepository(false);
            }}
          >
            {t('work_dashboard.change_repository')}
          </Button>
        </div>
        <div className={styles.controls}>
          <div className={styles.toggle} role="group" aria-label={t('work_dashboard.period')}>
            <Button
              size="sm"
              variant={period === 'day' ? 'secondary' : 'ghost'}
              aria-pressed={period === 'day'}
              onClick={() => setPeriod('day')}
            >
              {t('work_dashboard.day')}
            </Button>
            <Button
              size="sm"
              variant={period === 'week' ? 'secondary' : 'ghost'}
              aria-pressed={period === 'week'}
              onClick={() => setPeriod('week')}
            >
              {t('work_dashboard.week')}
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={!connected}
            loading={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <IconRefreshCw size={14} /> {t('common.refresh')}
          </Button>
        </div>
      </header>
      {editing && (
        <form
          className={styles.repositoryForm}
          onSubmit={(event) => {
            event.preventDefault();
            const next = draftRepository.trim();
            if (!repositoryPattern.test(next)) {
              setInvalidRepository(true);
              return;
            }
            setRepository(next);
            setEditing(false);
            setInvalidRepository(false);
          }}
        >
          <Input
            label={t('work_dashboard.repository')}
            value={draftRepository}
            onChange={(event) => setDraftRepository(event.target.value)}
            placeholder="owner/repository"
            error={invalidRepository ? t('work_dashboard.invalid_repository') : undefined}
          />
          <Button type="submit" size="sm">
            {t('work_dashboard.apply')}
          </Button>
        </form>
      )}
      <p className={styles.note}>
        {new Date(window.since).toLocaleDateString(i18n.language, {
          month: 'short',
          day: 'numeric',
        })}{' '}
        –{' '}
        {new Date(Date.parse(window.until) - 1).toLocaleDateString(i18n.language, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      {loading && (
        <p className={styles.empty} role="status">
          {t('work_dashboard.loading')}
        </p>
      )}
      {!connected && <p className={styles.empty}>{t('cursor_usage.disconnected')}</p>}
      {current?.status === 'error' && (
        <div className={styles.error} role="alert">
          {t(`work_dashboard.error_${current.reason}`)}
        </div>
      )}
      {current?.status === 'success' && (
        <>
          <GitHubActivityPanel data={current.data} period={period} window={window} />
          <p className={styles.note}>
            {t('work_dashboard.checked', {
              at: new Date(current.data.checkedAt).toLocaleTimeString(i18n.language),
            })}
          </p>
        </>
      )}
    </section>
  );
}
