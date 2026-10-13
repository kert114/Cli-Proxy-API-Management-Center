import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { IconGithub, IconRefreshCw } from '@/components/ui/icons';
import type { GitHubActivity as Activity, GitHubPullRequest } from '@/services/api/githubActivity';
import type { ActivityPeriod } from './window';
import { ACCOUNT, ORGANIZATION, useGitHubActivity } from './useGitHubActivity';
import { ActivityChart } from './ActivityChart';
import {
  DEFAULT_PREFERENCES,
  readWorkspacePreferences,
  saveWorkspacePreferences,
  type WorkspacePreferences,
} from './preferences';
import { needsAttention, selectPullRequests } from './workspace';
import styles from './GitHubActivity.module.scss';
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
  preferenceScope = '',
}: {
  data: Activity;
  period: ActivityPeriod;
  window: { since: string; until: string };
  preferenceScope?: string;
}) {
  const { t, i18n } = useTranslation();
  const [preferences, setPreferences] = useState(() => readWorkspacePreferences(preferenceScope));
  const [search, setSearch] = useState('');
  const [inspected, setInspected] = useState<GitHubPullRequest>();
  const [activityTab, setActivityTab] = useState<'prs' | 'commits' | 'issues' | 'reviews'>(
    'commits'
  );
  const account =
    data.scope.kind === 'organization'
      ? data.scope.account
      : data.scope.kind === 'account'
        ? data.scope.login
        : ACCOUNT;
  const organization = data.scope.kind === 'organization' ? data.scope.name : ORGANIZATION;
  const change = (patch: Partial<WorkspacePreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    saveWorkspacePreferences(preferenceScope, next);
  };
  const rows = selectPullRequests(data.openPRs, { ...preferences, search, account });
  const scoped = data.openPRs.filter(
    (pr) => !preferences.repository || pr.repository === preferences.repository
  );
  const filters = ['all', 'attention', 'mine', 'draft', 'review', 'approved'] as const;
  const filterCount = (filter: (typeof filters)[number]) =>
    selectPullRequests(scoped, { ...preferences, repository: '', filter, search: '', account })
      .length;
  const date = (value: string | undefined) =>
    value && Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleString(i18n.language, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : t('work_dashboard.unknown');
  const range = `${window.since}..${new Date(Date.parse(window.until) - 1000).toISOString()}`;
  const searchURL = (query: string) =>
    `https://github.com/search?${new URLSearchParams({ q: query, type: 'issues' })}`;
  const metrics = [
    {
      label: t('work_dashboard.organization_open'),
      count: data.openCount,
      url: searchURL(`is:pr is:open org:${organization}`),
    },
    {
      label: t(`work_dashboard.created_${period}`),
      count: data.createdCount,
      url: searchURL(`is:pr author:${account} org:${organization} created:${range}`),
    },
    {
      label: t(`work_dashboard.merged_${period}`),
      count: data.mergedCount,
      url: searchURL(`is:pr author:${account} org:${organization} merged:${range}`),
    },
    { label: t(`work_dashboard.commits_${period}`), count: data.commitCount },
    {
      label: t('work_dashboard.issues'),
      count: data.issueCount,
      url: searchURL(`is:issue author:${account} org:${organization} created:${range}`),
    },
    { label: t('work_dashboard.reviews'), count: data.reviewCount },
  ];
  const badge = (pr: GitHubPullRequest) => (
    <div className={styles.badges}>
      {pr.draft && <span className={styles.neutral}>{t('work_dashboard.draft')}</span>}
      <span
        className={
          pr.checks === 'SUCCESS'
            ? styles.good
            : ['FAILURE', 'ERROR'].includes(pr.checks)
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
  );
  const activities =
    activityTab === 'commits'
      ? data.commits
      : activityTab === 'prs'
        ? data.createdPRs.map((pr) => ({ ...pr, date: pr.createdAt }))
        : activityTab === 'issues'
          ? data.issues.map((issue) => ({ ...issue, date: issue.createdAt }))
          : data.reviews;
  const visibleActivity = activities.filter(
    (event) => !preferences.repository || event.repository === preferences.repository
  );
  return (
    <>
      <div className={styles.metrics}>
        {metrics.map((metric, index) => (
          <div className={styles.metric} key={metric.label}>
            {metric.url ? (
              <a href={metric.url} target="_blank" rel="noopener noreferrer">
                <span>{metric.label}</span>
                <strong>
                  {metric.count.toLocaleString(i18n.language)}
                  {index === 0 && data.openTruncated && '+'}
                </strong>
              </a>
            ) : (
              <>
                <span>{metric.label}</span>
                <strong>{metric.count.toLocaleString(i18n.language)}</strong>
              </>
            )}
          </div>
        ))}
      </div>
      <div className={styles.scopeBar}>
        <p className={styles.note}>
          {t('work_dashboard.scope_summary', {
            organization,
            account,
            count: data.repositoryCount,
          })}
        </p>
        <label className={styles.selectLabel}>
          {t('work_dashboard.repo_scope')}
          <select
            value={preferences.repository}
            onChange={(event) => change({ repository: event.target.value })}
          >
            <option value="">{t('work_dashboard.all_repositories')}</option>
            {data.repositories.map((repo) => (
              <option key={repo.name} value={repo.name}>
                {repo.name}
              </option>
            ))}
            {preferences.repository &&
              !data.repositories.some((repo) => repo.name === preferences.repository) && (
                <option value={preferences.repository}>{preferences.repository}</option>
              )}
          </select>
        </label>
      </div>
      <ActivityChart
        key={`${period}:${window.since}`}
        data={data}
        period={period}
        window={window}
        preferences={preferences}
        change={change}
      />
      <div className={styles.columns}>
        <section className={styles.queue} aria-labelledby="github-queue-title">
          <div className={styles.chartHeading}>
            <div>
              <h3 id="github-queue-title">{t('work_dashboard.pr_queue')}</h3>
              <p className={styles.note}>{t('work_dashboard.queue_scope')}</p>
            </div>
            <span className={styles.count}>
              {rows.length} / {scoped.length}
            </span>
          </div>
          {data.openTruncated && <p className={styles.note}>{t('work_dashboard.search_limit')}</p>}
          {data.openPRs.length < data.openCount && (
            <p className={styles.note}>
              {t('work_dashboard.showing', { visible: data.openPRs.length, total: data.openCount })}
            </p>
          )}
          <div className={styles.queueControls}>
            <input
              type="search"
              aria-label={t('work_dashboard.search_prs')}
              placeholder={t('work_dashboard.search_prs')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label className={styles.selectLabel}>
              {t('work_dashboard.sort')}
              <select
                value={preferences.sort}
                onChange={(event) => {
                  const sort = event.target.value;
                  if (
                    sort === 'attention' ||
                    sort === 'draft' ||
                    sort === 'review' ||
                    sort === 'newest' ||
                    sort === 'repository'
                  )
                    change({ sort });
                }}
              >
                {(['attention', 'draft', 'review', 'newest', 'repository'] as const).map((sort) => (
                  <option key={sort} value={sort}>
                    {t(`work_dashboard.sort_${sort}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className={styles.filters}
            role="group"
            aria-label={t('work_dashboard.status_filter')}
          >
            {filters.map((filter) => (
              <Button
                key={filter}
                aria-label={`${t(`work_dashboard.filter_${filter}`)} ${filterCount(filter)}`}
                size="sm"
                variant={preferences.filter === filter ? 'secondary' : 'ghost'}
                aria-pressed={preferences.filter === filter}
                onClick={() => change({ filter })}
              >
                {t(`work_dashboard.filter_${filter}`)} <span>{filterCount(filter)}</span>
              </Button>
            ))}
          </div>
          <ul className={styles.queueList}>
            {rows.map((pr, index) => (
              <li key={pr.url} className={styles.queueItem} data-attention={needsAttention(pr)}>
                {preferences.sort === 'repository' &&
                  (index === 0 || rows[index - 1].repository !== pr.repository) && (
                    <h4 className={styles.repoGroup}>{pr.repository}</h4>
                  )}
                <div className={styles.queueRow}>
                  <div>
                    <a
                      className={styles.prTitle}
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={styles.number}>#{pr.number}</span>
                      {pr.title}
                    </a>
                    <p className={styles.meta}>
                      {pr.repository} · {pr.author || t('work_dashboard.unknown_author')} ·{' '}
                      {date(pr.createdAt)}
                    </p>
                    {badge(pr)}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('work_dashboard.inspect_pr', { number: pr.number })}
                    onClick={() => setInspected(pr)}
                  >
                    {t('work_dashboard.inspect')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {!rows.length && (
            <div className={styles.empty}>
              <p>{t('work_dashboard.no_matching_prs')}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  change({
                    ...DEFAULT_PREFERENCES,
                    metric: preferences.metric,
                    view: preferences.view,
                  });
                }}
              >
                {t('work_dashboard.reset_filters')}
              </Button>
            </div>
          )}
        </section>
        <aside className={styles.timeline} aria-label={t('work_dashboard.viewer_history')}>
          <h3>{t('work_dashboard.viewer_history', { account })}</h3>
          <p className={styles.note}>{t('work_dashboard.history_scope')}</p>
          <div
            className={styles.toggle}
            role="group"
            aria-label={t('work_dashboard.activity_type')}
          >
            {(['commits', 'prs', 'reviews', 'issues'] as const).map((tab) => (
              <Button
                key={tab}
                size="sm"
                variant={activityTab === tab ? 'secondary' : 'ghost'}
                aria-pressed={activityTab === tab}
                onClick={() => setActivityTab(tab)}
              >
                {t(`work_dashboard.${tab}`)}
              </Button>
            ))}
          </div>
          <ul className={styles.feed}>
            {visibleActivity.slice(0, 100).map((event, index) => (
              <li key={event.url + index}>
                <span className={styles.feedDot} />
                <div>
                  <span className={styles.meta}>{date(event.date)}</span>
                  <a href={event.url} target="_blank" rel="noopener noreferrer">
                    {event.title}
                  </a>
                  <span className={styles.meta}>{event.repository}</span>
                </div>
              </li>
            ))}
          </ul>
          {!visibleActivity.length && (
            <p className={styles.empty}>{t('work_dashboard.no_listed_events')}</p>
          )}
        </aside>
      </div>
      <Modal
        open={!!inspected}
        onClose={() => setInspected(undefined)}
        title={inspected ? `#${inspected.number} ${inspected.title}` : ''}
      >
        {inspected && (
          <div className={styles.statusDetail}>
            <p className={styles.meta}>{inspected.repository}</p>
            {badge(inspected)}
            <dl>
              <dt>{t('work_dashboard.draft')}</dt>
              <dd>{t(inspected.draft ? 'common.yes' : 'common.no')}</dd>
              <dt>{t('work_dashboard.mergeability')}</dt>
              <dd>
                {inspected.mergeable === 'CONFLICTING'
                  ? t('work_dashboard.conflicts')
                  : inspected.mergeable === 'MERGEABLE'
                    ? t('work_dashboard.no_conflicts')
                    : t('work_dashboard.unknown')}
              </dd>
              <dt>{t('work_dashboard.created_at')}</dt>
              <dd>{date(inspected.createdAt)}</dd>
              <dt>{t('work_dashboard.updated_at')}</dt>
              <dd>{date(inspected.updatedAt)}</dd>
            </dl>
            <p className={styles.note}>{t('work_dashboard.readiness_unknown')}</p>
            <a href={inspected.url} target="_blank" rel="noopener noreferrer">
              {t('work_dashboard.open_github')}
            </a>
          </div>
        )}
      </Modal>
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
  const snapshot = useGitHubActivity(period, refreshToken);
  const now = useNow();
  const stale =
    !!snapshot.error ||
    snapshot.data?.cacheStatus === 'stale' ||
    snapshot.data?.refreshError ||
    (snapshot.data && now - Date.parse(snapshot.data.checkedAt) > 120_000);
  return (
    <section className={styles.section} aria-label={t('work_dashboard.github')}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <IconGithub size={25} />
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
          <span className={styles.note} role="status">
            {snapshot.refreshing
              ? t('work_dashboard.refreshing_snapshot')
              : snapshot.data
                ? t(stale ? 'work_dashboard.saved_snapshot' : 'work_dashboard.fresh_snapshot')
                : ''}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!snapshot.connected}
            loading={snapshot.refreshing}
            onClick={snapshot.refresh}
          >
            <IconRefreshCw size={14} />
            {t('common.refresh')}
          </Button>
        </div>
      </header>
      {!snapshot.connected && <p className={styles.empty}>{t('cursor_usage.disconnected')}</p>}
      {snapshot.connected && !snapshot.data && !snapshot.error && (
        <p className={styles.empty} role="status">
          {t('work_dashboard.loading')}
        </p>
      )}
      {snapshot.error && (
        <div className={styles.error} role="alert">
          {t(`work_dashboard.error_${snapshot.error}`)}
          {snapshot.data && <p>{t('work_dashboard.retained_snapshot')}</p>}
        </div>
      )}
      {!snapshot.error && snapshot.data?.refreshError && (
        <div className={styles.error} role="alert">
          {t('work_dashboard.retained_snapshot')}
        </div>
      )}
      {snapshot.data && (
        <>
          <GitHubActivityPanel
            key={snapshot.session}
            preferenceScope={`${snapshot.session}:${ACCOUNT}:${ORGANIZATION}`}
            data={snapshot.data}
            period={period}
            window={snapshot.window}
          />
          <p className={styles.note}>
            {t('work_dashboard.checked', {
              at: new Date(snapshot.data.checkedAt).toLocaleString(i18n.language),
            })}
          </p>
        </>
      )}
    </section>
  );
}
