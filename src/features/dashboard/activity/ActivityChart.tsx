import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { GitHubActivity } from '@/services/api/githubActivity';
import { activityBuckets, listedCount, listedEvents } from './workspace';
import type { WorkspacePreferences } from './preferences';
import type { ActivityPeriod } from './window';
import styles from './GitHubActivity.module.scss';
export function ActivityChart({
  data,
  period,
  window,
  preferences,
  change,
}: {
  data: GitHubActivity;
  period: ActivityPeriod;
  window: { since: string; until: string };
  preferences: WorkspacePreferences;
  change: (patch: Partial<WorkspacePreferences>) => void;
}) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<number>();
  const events = listedEvents(data, preferences.metric).filter(
    (event) =>
      (!preferences.repository || event.repository === preferences.repository) &&
      Date.parse(event.date) >= Date.parse(window.since) &&
      Date.parse(event.date) < Date.parse(window.until)
  );
  const buckets = activityBuckets(window, period);
  const repos = data.repositories.filter(
    (repo) => !preferences.repository || repo.name === preferences.repository
  );
  const counts = buckets.map((bucket) => listedCount(events, bucket));
  const max = Math.max(1, ...counts.map((count) => count ?? 0));
  const label = (instant: number) =>
    new Date(instant).toLocaleString(
      i18n.language,
      period === 'day'
        ? { hour: 'numeric' }
        : period === 'year'
          ? { month: 'short' }
          : { month: 'short', day: 'numeric' }
    );
  const activeBucket = selected === undefined ? undefined : buckets[selected];
  const selectedEvents = activeBucket
    ? events.filter(
        (event) =>
          Date.parse(event.date) >= activeBucket.since &&
          Date.parse(event.date) < activeBucket.until
      )
    : [];
  const cellLabel = (count: number | null) =>
    count === null
      ? t('work_dashboard.no_listed_events')
      : t('work_dashboard.listed_count', { count });
  return (
    <section className={styles.analytics} aria-label={t('work_dashboard.listed_activity')}>
      <div className={styles.chartHeading}>
        <div>
          <h3>
            {t(
              preferences.view === 'comparison'
                ? 'work_dashboard.exact_comparison'
                : 'work_dashboard.listed_activity'
            )}
          </h3>
          <p className={styles.note}>
            {t(
              preferences.view === 'comparison'
                ? 'work_dashboard.exact_coverage'
                : 'work_dashboard.partial_coverage'
            )}
          </p>
        </div>
        <div className={styles.toggle} role="group" aria-label={t('work_dashboard.chart_view')}>
          {(['bars', 'atlas', 'comparison'] as const).map((view) => (
            <Button
              key={view}
              size="sm"
              variant={preferences.view === view ? 'secondary' : 'ghost'}
              aria-pressed={preferences.view === view}
              onClick={() => {
                setSelected(undefined);
                change({ view });
              }}
            >
              {t(`work_dashboard.view_${view}`)}
            </Button>
          ))}
        </div>
      </div>
      {preferences.view !== 'comparison' && (
        <div className={styles.chartHeading}>
          <div
            className={styles.toggle}
            role="group"
            aria-label={t('work_dashboard.activity_type')}
          >
            {(['commits', 'prs', 'reviews'] as const).map((metric) => (
              <Button
                key={metric}
                size="sm"
                variant={preferences.metric === metric ? 'secondary' : 'ghost'}
                aria-pressed={preferences.metric === metric}
                onClick={() => {
                  setSelected(undefined);
                  change({ metric });
                }}
              >
                {t(`work_dashboard.${metric}`)}
              </Button>
            ))}
          </div>
          <span className={styles.count}>
            {t('work_dashboard.listed_count', { count: events.length })}
          </span>
        </div>
      )}
      {preferences.view === 'comparison' ? (
        <div className={styles.comparison}>
          {repos.map((repo) => (
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              key={repo.name}
              className={styles.comparisonRow}
            >
              <span>
                {repo.name.split('/')[1]}
                <small>{repo.defaultBranch}</small>
              </span>
              <span className={styles.comparisonTrack}>
                <span
                  style={{
                    width: `${(repo.commitCount / Math.max(1, ...repos.map((row) => row.commitCount))) * 100}%`,
                  }}
                />
              </span>
              <strong>{repo.commitCount.toLocaleString(i18n.language)}</strong>
            </a>
          ))}
          {!repos.length && <p className={styles.empty}>{t('work_dashboard.no_activity')}</p>}
        </div>
      ) : preferences.view === 'bars' ? (
        <div className={styles.chart} data-metric={preferences.metric}>
          <div className={styles.bars}>
            {buckets.map((bucket, index) => (
              <button
                type="button"
                key={bucket.since}
                className={styles.barButton}
                aria-pressed={selected === index}
                title={`${label(bucket.since)}: ${cellLabel(counts[index])}`}
                aria-label={`${label(bucket.since)}: ${cellLabel(counts[index])}`}
                onClick={() => setSelected(selected === index ? undefined : index)}
              >
                <span className={styles.barValue}>{counts[index] ?? '·'}</span>
                <span className={styles.barTrack}>
                  <span
                    className={counts[index] === null ? styles.missingBar : styles.bar}
                    style={{
                      height: `${counts[index] === null ? 3 : (counts[index] / max) * 100}%`,
                    }}
                  />
                </span>
                <span className={styles.barLabel}>
                  {index === 0 ||
                  index === buckets.length - 1 ||
                  index % Math.ceil(buckets.length / 7) === 0
                    ? label(bucket.since)
                    : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          className={styles.atlasScroll}
          role="region"
          aria-label={t('work_dashboard.view_atlas')}
          tabIndex={0}
          data-metric={preferences.metric}
        >
          <div
            className={styles.atlas}
            style={{ gridTemplateColumns: `150px repeat(${buckets.length}, minmax(24px, 1fr))` }}
          >
            <span />
            {buckets.map((bucket, index) => (
              <span key={bucket.since} className={styles.atlasLabel}>
                {index % Math.ceil(buckets.length / 6) === 0 ? label(bucket.since) : ''}
              </span>
            ))}
            {repos.map((repo) => (
              <div className={styles.atlasRow} key={repo.name}>
                <button
                  type="button"
                  className={styles.repoLabel}
                  onClick={() => change({ repository: repo.name })}
                >
                  {repo.name.split('/')[1]}
                </button>
                {buckets.map((bucket, index) => {
                  const count = listedCount(events, bucket, repo.name);
                  return (
                    <button
                      type="button"
                      key={bucket.since}
                      className={styles.cell}
                      data-present={count !== null}
                      style={{ opacity: count === null ? 1 : 0.35 + (0.65 * count) / max }}
                      aria-pressed={selected === index && preferences.repository === repo.name}
                      title={`${repo.name}, ${label(bucket.since)}: ${cellLabel(count)}`}
                      aria-label={`${repo.name}, ${label(bucket.since)}: ${cellLabel(count)}`}
                      onClick={() => {
                        setSelected(index);
                        change({ repository: repo.name });
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {preferences.view !== 'comparison' && (
        <>
          <p className={styles.note}>{t('work_dashboard.empty_bucket_note')}</p>
          {activeBucket && (
            <div className={styles.dayDetail}>
              <strong>{label(activeBucket.since)}</strong>
              <Button size="sm" variant="ghost" onClick={() => setSelected(undefined)}>
                {t('common.close')}
              </Button>
              {selectedEvents.length ? (
                <ul>
                  {selectedEvents.slice(0, 10).map((event, index) => (
                    <li key={event.url + index}>
                      <a href={event.url} target="_blank" rel="noopener noreferrer">
                        {event.title}
                      </a>
                      <small>{event.repository}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.note}>{t('work_dashboard.no_listed_events')}</p>
              )}
            </div>
          )}
          <details className={styles.chartData}>
            <summary>{t('work_dashboard.chart_data')}</summary>
            <table>
              <thead>
                <tr>
                  <th>{t('work_dashboard.date')}</th>
                  <th>{t('work_dashboard.listed_activity')}</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket, index) => (
                  <tr key={bucket.since}>
                    <td>{label(bucket.since)}</td>
                    <td>{cellLabel(counts[index])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
