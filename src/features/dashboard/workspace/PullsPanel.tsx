import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import {
  ORGANIZATION,
  type DashboardPullRequest,
  type GitHubPulls,
} from '@/services/api/githubDashboard';
import { CollapseButton } from '@/components/ui/CollapseButton';
import { SnapshotStatus } from './SnapshotStatus';
import { usePulls } from './useDashboardData';
import {
  checksLabel,
  groupPullRequests,
  matchesPullFilter,
  matchesRepositoryFilter,
  REPOSITORY_FILTERS,
  type RepositoryFilter,
  PULL_FILTERS,
  reviewLabel,
  type PullFilter,
} from './pulls';
import styles from './Workspace.module.scss';

function PullBadges({ pr }: { pr: DashboardPullRequest }) {
  const { t } = useTranslation();
  return (
    <div className={styles.badges}>
      <span
        data-tone={pr.state === 'MERGED' ? 'merged' : pr.state === 'CLOSED' ? 'neutral' : 'good'}
      >
        {t(`work_dashboard.state_${pr.state.toLowerCase()}`)}
      </span>
      {pr.draft && <span>{t('work_dashboard.draft')}</span>}
      <span
        data-tone={
          pr.checks === 'SUCCESS'
            ? 'good'
            : ['FAILURE', 'ERROR'].includes(pr.checks)
              ? 'bad'
              : 'neutral'
        }
      >
        {t(`work_dashboard.${checksLabel(pr.checks)}`)}
      </span>
      <span
        data-tone={
          pr.review === 'APPROVED' ? 'good' : pr.review === 'CHANGES_REQUESTED' ? 'bad' : 'neutral'
        }
      >
        {t(`work_dashboard.${reviewLabel(pr.review)}`)}
      </span>
      <span data-tone={pr.mergeable === 'CONFLICTING' ? 'bad' : 'neutral'}>
        {t(
          pr.mergeable === 'CONFLICTING'
            ? 'work_dashboard.conflicts'
            : pr.mergeable === 'MERGEABLE'
              ? 'work_dashboard.no_conflicts'
              : 'workspace.conflicts_unknown'
        )}
      </span>
    </div>
  );
}

export function PullRepositoryCards({ data }: { data: GitHubPulls }) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<PullFilter>('all');
  const [repository, setRepository] = useState('');
  const [repositoryFilters, setRepositoryFilters] = useState<Record<string, RepositoryFilter>>({});
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const id = useId();
  const groups = groupPullRequests(data.pullRequests, { filter, repository, search });
  const repositories = [...new Set(data.pullRequests.map((pr) => pr.repository))].sort();
  const scoped = data.pullRequests.filter((pr) => !repository || pr.repository === repository);
  const date = (value: string) =>
    new Date(value).toLocaleString(i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          aria-label={t('work_dashboard.search_prs')}
          placeholder={t('work_dashboard.search_prs')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className={styles.repositorySelect}>
          {t('work_dashboard.repo_scope')}
          <select value={repository} onChange={(event) => setRepository(event.target.value)}>
            <option value="">{t('work_dashboard.all_repositories')}</option>
            {repositories.map((repo) => (
              <option key={repo} value={repo}>
                {repo}
              </option>
            ))}
            {repository && !repositories.includes(repository) && (
              <option value={repository}>{repository}</option>
            )}
          </select>
        </label>
      </div>
      <div className={styles.filters} role="group" aria-label={t('work_dashboard.status_filter')}>
        {PULL_FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={value === filter ? 'secondary' : 'ghost'}
            aria-pressed={value === filter}
            onClick={() => setFilter(value)}
          >
            {t(`workspace.filter_${value}`)}{' '}
            <span>{scoped.filter((pr) => matchesPullFilter(pr, value)).length}</span>
          </Button>
        ))}
      </div>
      {data.truncated && <p className={styles.note}>{t('workspace.pulls_truncated')}</p>}
      <div className={styles.repositories}>
        {groups.map((group, index) => {
          const controls = `${id}-${index}`;
          const isCollapsed = collapsed.has(group.repository);
          const repositoryFilter = repositoryFilters[group.repository] ?? 'all';
          const visiblePulls = group.pullRequests.filter((pr) =>
            matchesRepositoryFilter(pr, repositoryFilter)
          );
          return (
            <article className={styles.repository} key={group.repository}>
              <header className={styles.repoHeading}>
                <CollapseButton
                  collapsed={isCollapsed}
                  label={group.repository}
                  controls={controls}
                  onClick={() =>
                    setCollapsed((previous) => {
                      const next = new Set(previous);
                      if (next.has(group.repository)) next.delete(group.repository);
                      else next.add(group.repository);
                      return next;
                    })
                  }
                />
                <h3>
                  <a
                    href={`https://github.com/${group.repository}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {group.repository}
                  </a>
                </h3>
                <span>
                  {visiblePulls.length} / {group.pullRequests.length}
                </span>
              </header>
              <div id={controls} hidden={isCollapsed}>
                <div
                  className={styles.repoFilters}
                  role="group"
                  aria-label={`${group.repository}: ${t('work_dashboard.status_filter')}`}
                >
                  {REPOSITORY_FILTERS.map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={value === repositoryFilter ? 'secondary' : 'ghost'}
                      aria-pressed={value === repositoryFilter}
                      onClick={() =>
                        setRepositoryFilters((previous) => ({
                          ...previous,
                          [group.repository]: value,
                        }))
                      }
                    >
                      {t(`workspace.filter_${value}`)}
                    </Button>
                  ))}
                </div>
                <ul
                  className={styles.pullList}
                  tabIndex={0}
                  aria-label={`${group.repository}: ${t('workspace.pull_requests')}`}
                >
                  {visiblePulls.map((pr) => (
                    <li key={pr.url}>
                      <a
                        className={styles.pullTitle}
                        title={pr.title}
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span>#{pr.number}</span> {pr.title}
                      </a>
                      <p className={styles.meta}>
                        {pr.author || t('work_dashboard.unknown_author')} /{' '}
                        {t('work_dashboard.updated_at')}{' '}
                        <time dateTime={pr.updatedAt}>{date(pr.updatedAt)}</time>
                      </p>
                      <PullBadges pr={pr} />
                    </li>
                  ))}
                  {!visiblePulls.length && (
                    <li className={styles.repositoryEmpty}>
                      {t('work_dashboard.no_matching_prs')}
                    </li>
                  )}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
      {!groups.length && <p className={styles.empty}>{t('work_dashboard.no_matching_prs')}</p>}
      <p className={styles.note}>{t('workspace.pr_scope')}</p>
    </>
  );
}
export function PullsPanel() {
  const { t } = useTranslation();
  const snapshot = usePulls();
  const [collapsed, setCollapsed] = useState(false);
  const id = useId();
  return (
    <section className={styles.section} aria-label={t('workspace.pull_requests')}>
      <header className={styles.heading}>
        <div className={styles.headingTitle}>
          <CollapseButton
            collapsed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
            label={t('workspace.pull_requests')}
            controls={id}
          />
          <h2>{t('workspace.pull_requests')}</h2>
          <a href={`https://github.com/${ORGANIZATION}`} target="_blank" rel="noopener noreferrer">
            {ORGANIZATION}
          </a>
        </div>
        <div className={styles.actions}>
          <SnapshotStatus {...snapshot} />
          <Button
            variant="secondary"
            size="sm"
            disabled={!snapshot.connected || snapshot.refreshing}
            loading={snapshot.refreshing}
            onClick={snapshot.refresh}
          >
            {t('workspace.refresh_pulls')}
          </Button>
        </div>
      </header>
      <div id={id} hidden={collapsed}>
        {snapshot.data && <PullRepositoryCards key={snapshot.session} data={snapshot.data} />}
      </div>
    </section>
  );
}
