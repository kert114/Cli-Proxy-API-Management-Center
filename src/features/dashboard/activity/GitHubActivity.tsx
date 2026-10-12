import { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconGithub, IconRefreshCw } from '@/components/ui/icons';
import { useAuthStore, useQuotaStore } from '@/stores';
import { useNow } from '@/hooks/useNow';
import {
  githubActivityApi,
  type GitHubActivity as Activity,
  type GitHubPullRequest,
} from '@/services/api/githubActivity';
import { activityWindow, type ActivityPeriod } from './window';
import styles from './GitHubActivity.module.scss';

const ACCOUNT = 'kert114';
const ORGANIZATION = '60xAI';

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
  const [activityTab, setActivityTab] = useState<'prs' | 'commits' | 'issues' | 'reviews'>('prs');
  const openList = useRef<HTMLDivElement>(null);
  const activityList = useRef<HTMLDivElement>(null);
  const account = data.scope.kind === 'account' ? data.scope.login : ACCOUNT;
  const qualifier = data.scope.kind === 'organization' ? ` org:${data.scope.name}` : '';
  const range = `${window.since}..${new Date(Date.parse(window.until) - 1000).toISOString()}`;
  const searchURL = (query: string, type = 'issues') =>
    `https://github.com/search?${new URLSearchParams({ q: query, type })}`;

  const metrics = [
    {
      label: t('work_dashboard.open_prs'),
      count: data.openCount,
      url: searchURL(`is:pr is:open org:${ORGANIZATION}`),
    },
    {
      label: t(`work_dashboard.created_${period}`),
      count: data.createdCount,
      url: searchURL(`is:pr author:${account}${qualifier} created:${range}`),
    },
    {
      label: t(`work_dashboard.merged_${period}`),
      count: data.mergedCount,
      url: searchURL(`is:pr author:${account}${qualifier} merged:${range}`),
    },
    {
      label: t(`work_dashboard.commits_${period}`),
      count: data.commitCount,
      url: '',
    },
    {
      label: t('work_dashboard.issues'),
      count: data.issueCount,
      url: searchURL(`is:issue author:${account}${qualifier} created:${range}`),
    },
    {
      label: t('work_dashboard.reviews'),
      count: data.reviewCount,
      url: '',
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
  const renderPR = (pr: GitHubPullRequest, status: boolean) => (
    <li key={pr.url}>
      <a className={styles.row} href={pr.url} target="_blank" rel="noopener noreferrer">
        <div className={styles.rowTitle}>
          <span className={styles.number}>#{pr.number}</span>
          <strong>{pr.title}</strong>
        </div>
        <span className={styles.meta}>
          {pr.repository} · {pr.author || t('work_dashboard.unknown_author')}
          {pr.draft && ` · ${t('work_dashboard.draft')}`}
          {!status &&
            ` · ${t(`work_dashboard.state_${pr.state.toLowerCase()}`, { defaultValue: pr.state })} · ${date(pr.createdAt)}`}
        </span>
        {status && (
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
        )}
      </a>
    </li>
  );
  const activities =
    activityTab === 'commits'
      ? data.commits.map((commit) => ({
          url: commit.url,
          title: commit.title,
          prefix: commit.sha.slice(0, 7),
          repository: commit.repository,
          date: commit.date,
        }))
      : activityTab === 'issues'
        ? data.issues.map((issue) => ({
            url: issue.url,
            title: issue.title,
            prefix: `#${issue.number}`,
            repository: issue.repository,
            date: issue.createdAt,
          }))
        : data.reviews.map((review) => ({
            url: review.url,
            title: review.title,
            prefix: '',
            repository: review.repository,
            date: review.date,
          }));
  const activityCount =
    activityTab === 'commits'
      ? data.commitCount
      : activityTab === 'issues'
        ? data.issueCount
        : data.reviewCount;
  return (
    <>
      <div className={styles.metrics}>
        {metrics.map((metric, index) =>
          (index === 0 && data.scope.kind !== 'organization') || index === 3 || index === 5 ? (
            <button
              key={metric.label}
              className={styles.metric}
              type="button"
              onClick={() => {
                if (index === 0) {
                  openList.current?.scrollIntoView({ block: 'center' });
                  return;
                }
                setActivityTab(index === 3 ? 'commits' : 'reviews');
                activityList.current?.scrollIntoView({ block: 'center' });
              }}
            >
              <span>{metric.label}</span>
              <strong>
                {metric.count.toLocaleString()}
                {index === 0 && data.openTruncated && '+'}
              </strong>
            </button>
          ) : (
            <a
              key={metric.label}
              className={styles.metric}
              href={metric.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{metric.label}</span>
              <strong>
                {metric.count.toLocaleString()}
                {index === 0 && data.openTruncated && '+'}
              </strong>
            </a>
          )
        )}
      </div>
      <p className={styles.note}>
        {t('work_dashboard.organization_scope', {
          account,
          organization: ORGANIZATION,
          count: data.repositoryCount,
        })}
      </p>
      {data.openTruncated && <p className={styles.note}>{t('work_dashboard.search_limit')}</p>}
      <div className={styles.columns}>
        <Card
          title={t('work_dashboard.open_prs')}
          extra={
            <span className={styles.count}>
              {data.openCount}
              {data.openTruncated && '+'}
            </span>
          }
        >
          <div ref={openList}>
            {data.openPRs.length ? (
              <ul className={styles.list}>{data.openPRs.map((pr) => renderPR(pr, true))}</ul>
            ) : (
              <p className={styles.empty}>{t('work_dashboard.no_open_prs')}</p>
            )}
            {shown(data.openPRs.length, data.openCount)}
          </div>
        </Card>
        <Card
          title={t(`work_dashboard.activity_${period}`)}
          extra={
            <div
              className={styles.toggle}
              role="group"
              aria-label={t('work_dashboard.activity_type')}
            >
              {(['prs', 'commits', 'issues', 'reviews'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activityTab === tab ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={activityTab === tab}
                  onClick={() => setActivityTab(tab)}
                >
                  {t(`work_dashboard.${tab}`)}
                </Button>
              ))}
            </div>
          }
        >
          <div ref={activityList}>
            {activityTab === 'prs' ? (
              <>
                {data.createdPRs.length ? (
                  <ul className={styles.list}>
                    {data.createdPRs.map((pr) => renderPR(pr, false))}
                  </ul>
                ) : (
                  <p className={styles.empty}>{t('work_dashboard.no_created_prs')}</p>
                )}
                {shown(data.createdPRs.length, data.createdCount)}
              </>
            ) : (
              <>
                {activities.length ? (
                  <ul className={styles.list}>
                    {activities.map((item) => (
                      <li key={item.url + item.date}>
                        <a
                          className={styles.row}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div className={styles.rowTitle}>
                            <span className={styles.number}>{item.prefix}</span>
                            <strong>{item.title}</strong>
                          </div>
                          <span className={styles.meta}>
                            {item.repository} · {date(item.date)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.empty}>{t('work_dashboard.no_activity')}</p>
                )}
                {shown(activities.length, activityCount)}
              </>
            )}
          </div>
        </Card>
      </div>
      <Card
        title={t('work_dashboard.repositories')}
        extra={<span className={styles.count}>{data.repositoryCount}</span>}
      >
        <ul className={styles.repositoryList}>
          {data.repositories.map((repo) => (
            <li key={repo.name}>
              <a className={styles.row} href={repo.url} target="_blank" rel="noopener noreferrer">
                <strong>{repo.name}</strong>
                <span className={styles.meta}>
                  {t('work_dashboard.repository_commits', { count: repo.commitCount })}
                  {repo.fork && ` · ${t('work_dashboard.fork')}`}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export function GitHubActivity({
  period,
  refreshToken = 0,
}: {
  period: ActivityPeriod;
  refreshToken?: number;
}) {
  const { t, i18n } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const connected = useAuthStore((state) => state.connectionStatus === 'connected');
  const session = useQuotaStore((state) => state.cacheGeneration);
  const [refreshing, setRefreshing] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);
  const now = useNow();
  const window = useMemo(() => activityWindow(period, new Date(now)), [period, now]);
  const { since, until } = window;
  const key = JSON.stringify([apiBase, session, ACCOUNT, ORGANIZATION, period, window.since]);

  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      setRefreshing(true);
      setState((previous) => (previous?.key === key ? previous : { key, status: 'loading' }));
      void githubActivityApi
        .getOrganization(ACCOUNT, ORGANIZATION, { since, until }, controller.signal)
        .then(
          (data) => {
            if (!controller.signal.aborted) {
              setState({ key, status: 'success', data });
              setRefreshing(false);
            }
          },
          (error: unknown) => {
            if (controller.signal.aborted) return;
            const status =
              error !== null && typeof error === 'object' && 'status' in error
                ? error.status
                : null;
            setRefreshing(false);
            setState({
              key,
              status: 'error',
              reason: status === 403 ? 'local' : status === 404 ? 'backend' : 'unavailable',
            });
          }
        )
        .finally(() => {
          if (!controller.signal.aborted) timer = setTimeout(load, 60_000);
        });
    };
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [connected, key, since, until, refresh, refreshToken]);

  const current = connected && state?.key === key ? state : null;
  const loading = connected && (refreshing || !current || current.status === 'loading');
  return (
    <section className={styles.section} aria-label={t('work_dashboard.github')}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <IconGithub size={24} />
          <div>
            <h2>{t('work_dashboard.github')}</h2>
            <a
              href={`https://github.com/${ORGANIZATION}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ORGANIZATION}
            </a>
          </div>
        </div>
        <div className={styles.controls}>
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
      {loading && current?.status !== 'success' && (
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
