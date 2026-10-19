import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ACCOUNT } from '@/services/api/githubDashboard';
import type { ContributionDay } from '@/services/api/githubDashboard';
import { CollapseButton } from '@/components/ui/CollapseButton';
import { SnapshotStatus } from './SnapshotStatus';
import { useStatistics } from './useDashboardData';
import {
  adjacentStatisticsYear,
  contributionSummary,
  contributionFocusIndex,
  dailyLinePoints,
  dateKey,
  periodBounds,
  selectContributionDays,
  shiftPeriod,
  utcDate,
  type StatisticsPeriod,
} from './statistics';
import styles from './Workspace.module.scss';

export function ContributionChart({
  days,
  period,
  view,
  selected,
  onSelect,
}: {
  days: ContributionDay[];
  period: StatisticsPeriod;
  view: 'heatmap' | 'line';
  selected: string;
  onSelect: (date: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState<ContributionDay>();
  const points = useMemo(() => dailyLinePoints(days), [days]);
  const peak = Math.max(1, ...days.map((day) => day.contributions));
  const label = (day: ContributionDay) =>
    t('workspace.day_count', {
      date: new Date(`${day.date}T00:00:00Z`).toLocaleDateString(i18n.language, {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      count: day.contributions,
    });
  const keyboard = (event: React.KeyboardEvent, index: number) => {
    const next = contributionFocusIndex({ key: event.key, index, view, total: days.length });
    if (next === undefined) return;
    event.preventDefault();
    const target = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
      '[data-contribution-date]'
    )[next];
    target?.focus();
  };
  const interaction = (day: ContributionDay, index: number) => ({
    'data-contribution-date': day.date,
    'aria-label': label(day),
    'aria-pressed': selected === day.date,
    onClick: () => onSelect(day.date),
    onMouseEnter: () => setHovered(day),
    onMouseLeave: () => setHovered(undefined),
    onFocus: () => setHovered(day),
    onBlur: () => setHovered(undefined),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(day.date);
      } else keyboard(event, index);
    },
  });
  const firstWeekday = days.length ? (utcDate(days[0].date).getUTCDay() + 6) % 7 : 0;
  const weeks = Math.ceil((days.length + firstWeekday) / 7);
  return (
    <div className={styles.chart}>
      <div className={styles.tooltip} role="status" aria-live="polite">
        {hovered ? label(hovered) : t('workspace.chart_hint')}
      </div>
      {!days.length ? (
        <p>{t('workspace.no_days')}</p>
      ) : view === 'line' ? (
        <div className={styles.lineScroll}>
          <svg
            className={styles.line}
            viewBox="0 0 1000 210"
            role="group"
            aria-label={t('workspace.daily_chart')}
          >
            {[0, 1, 2].map((step) => (
              <g key={step}>
                <line
                  x1="30"
                  x2="970"
                  y1={24 + step * 75}
                  y2={24 + step * 75}
                  className={styles.gridLine}
                />
                <text x="3" y={28 + step * 75}>
                  {Math.round(peak * (1 - step / 2))}
                </text>
              </g>
            ))}
            <polyline
              points={points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="var(--viz-success)"
              strokeWidth="2"
            />
            {points.map((point, index) => (
              <circle
                key={point.date}
                {...interaction(point, index)}
                role="button"
                tabIndex={0}
                cx={point.x}
                cy={point.y}
                r={selected === point.date ? 5 : 3}
                className={styles.linePoint}
              >
                <title>{label(point)}</title>
              </circle>
            ))}
            <text x="30" y="204">
              {days[0].date}
            </text>
            <text x="970" y="204" textAnchor="end">
              {days[days.length - 1].date}
            </text>
          </svg>
        </div>
      ) : (
        <div className={styles.heatmapScroll}>
          {period === 'year' && (
            <div
              className={styles.monthLabels}
              aria-hidden="true"
              style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
            >
              {days.map(
                (day, index) =>
                  (index === 0 || day.date.endsWith('-01')) && (
                    <span
                      key={day.date}
                      style={{ gridColumn: Math.floor((index + firstWeekday) / 7) + 1 }}
                    >
                      {utcDate(day.date).toLocaleDateString(i18n.language, {
                        month: 'short',
                        timeZone: 'UTC',
                      })}
                    </span>
                  )
              )}
            </div>
          )}
          <div
            className={`${styles.heatmap} ${period === 'month' ? styles.monthHeatmap : ''}`}
            role="group"
            aria-label={t('workspace.daily_chart')}
          >
            {days.map((day, index) => (
              <button
                key={day.date}
                type="button"
                {...interaction(day, index)}
                className={styles.heatCell}
                style={{
                  gridRow: ((utcDate(day.date).getUTCDay() + 6) % 7) + 1,
                  ...(index === 0 ? { gridColumn: 1 } : {}),
                  background:
                    day.contributions === 0
                      ? 'var(--bg-tertiary)'
                      : `color-mix(in srgb, var(--viz-success) ${Math.max(25, Math.round((day.contributions / peak) * 100))}%, var(--bg-secondary))`,
                }}
              >
                <span className={styles.srOnly}>{label(day)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {view === 'heatmap' && (
        <div className={styles.legend}>
          <span>{t('workspace.less')}</span>
          {[0, 25, 50, 75, 100].map((level) => (
            <i
              key={level}
              style={{
                background: level
                  ? `color-mix(in srgb, var(--viz-success) ${level}%, var(--bg-secondary))`
                  : 'var(--bg-tertiary)',
              }}
            />
          ))}
          <span>{t('workspace.more')}</span>
        </div>
      )}
    </div>
  );
}

export function StatisticsPanel() {
  const { t, i18n } = useTranslation();
  const today = dateKey(new Date());
  const [anchor, setAnchor] = useState(today);
  const [period, setPeriod] = useState<StatisticsPeriod>('year');
  const [view, setView] = useState<'heatmap' | 'line'>('heatmap');
  const [collapsed, setCollapsed] = useLocalStorage('workspace.statisticsCollapsed', false);
  const [selected, setSelected] = useState('');
  const id = useId();
  const year = Number(anchor.slice(0, 4));
  const snapshot = useStatistics(year);
  const adjacentYear = adjacentStatisticsYear(period, anchor, today);
  const adjacent = useStatistics(adjacentYear ?? year, adjacentYear !== undefined);
  const data =
    snapshot.data && (adjacentYear === undefined || adjacent.data)
      ? {
          ...snapshot.data,
          checkedAt:
            adjacent.data && adjacent.data.checkedAt < snapshot.data.checkedAt
              ? adjacent.data.checkedAt
              : snapshot.data.checkedAt,
          stale: snapshot.data.stale || Boolean(adjacent.data?.stale),
          limited: snapshot.data.limited || Boolean(adjacent.data?.limited),
          days: [...snapshot.data.days, ...(adjacent.data?.days ?? [])].sort((a, b) =>
            a.date.localeCompare(b.date)
          ),
        }
      : undefined;
  const refreshing = snapshot.refreshing || adjacent.refreshing;
  const refresh = () => {
    snapshot.refresh();
    if (adjacentYear !== undefined) adjacent.refresh();
  };
  const days = selectContributionDays(data?.days ?? [], period, anchor);
  const summary = contributionSummary(days);
  const { start, end } = periodBounds(period, anchor);
  const selectedDay = days.find((day) => day.date === selected);
  const changeAnchor = (value: string) => {
    setAnchor(value > today ? today : value);
    setSelected('');
  };
  const rangeLabel =
    period === 'year'
      ? String(year)
      : period === 'day'
        ? anchor
        : period === 'month'
          ? utcDate(anchor).toLocaleDateString(i18n.language, {
              timeZone: 'UTC',
              month: 'long',
              year: 'numeric',
            })
          : `${start} / ${dateKey(new Date(Date.parse(`${end}T00:00:00Z`) - 86400000))}`;
  return (
    <section className={styles.section} aria-label={t('workspace.statistics')}>
      <header className={styles.heading}>
        <div className={styles.headingTitle}>
          <CollapseButton
            collapsed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
            label={t('workspace.statistics')}
            controls={id}
          />
          <h2>{t('workspace.statistics')}</h2>
          <a href={`https://github.com/${ACCOUNT}`} target="_blank" rel="noopener noreferrer">
            {ACCOUNT}
          </a>
        </div>
        <div className={styles.actions}>
          <SnapshotStatus
            {...snapshot}
            data={data}
            refreshing={refreshing}
            error={snapshot.error ?? adjacent.error}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!snapshot.connected || refreshing}
            loading={refreshing}
            onClick={refresh}
          >
            {t('workspace.refresh_statistics')}
          </Button>
        </div>
      </header>
      <div id={id} hidden={collapsed} className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.toggle} role="group" aria-label={t('work_dashboard.period')}>
            {(['day', 'week', 'month', 'year'] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={period === value ? 'secondary' : 'ghost'}
                aria-pressed={period === value}
                onClick={() => {
                  setPeriod(value);
                  setSelected('');
                }}
              >
                {t(`work_dashboard.${value}`)}
              </Button>
            ))}
          </div>
          {(period === 'month' || period === 'year') && (
            <div className={styles.toggle} role="group" aria-label={t('work_dashboard.chart_view')}>
              {(['heatmap', 'line'] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={view === value ? 'secondary' : 'ghost'}
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                >
                  {t(`workspace.${value}`)}
                </Button>
              ))}
            </div>
          )}
          <div className={styles.metrics}>
            {[
              { label: 'contributions', value: summary.total },
              { label: 'active_days', value: summary.activeDays },
              { label: 'peak_day', value: summary.peak },
            ].map((metric) => (
              <div key={metric.label}>
                <strong>{data ? metric.value.toLocaleString(i18n.language) : '—'}</strong>
                <span>{t(`workspace.${metric.label}`)}</span>
              </div>
            ))}
          </div>
          <div className={styles.navigation}>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('workspace.previous_period')}
              disabled={year <= 2008 && start <= '2008-01-01'}
              onClick={() => changeAnchor(shiftPeriod(anchor, period, -1))}
            >
              ‹
            </Button>
            <strong>{rangeLabel}</strong>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('workspace.next_period')}
              disabled={end > today}
              onClick={() => changeAnchor(shiftPeriod(anchor, period, 1))}
            >
              ›
            </Button>
            <Button size="sm" variant="ghost" onClick={() => changeAnchor(today)}>
              {t('workspace.today')}
            </Button>
          </div>
        </div>
        <details className={styles.scopeNote}>
          <summary>{t('workspace.all_repositories')}</summary>
          <p>{t('workspace.daily_note', { account: ACCOUNT })}</p>
        </details>
        {data?.limited && (
          <div className={styles.warning} role="status">
            <p>{t('workspace.limited_contributions')}</p>
            <code>gh auth refresh --hostname github.com --scopes read:user</code>
          </div>
        )}
        <ContributionChart
          days={days}
          period={period}
          view={period === 'day' || period === 'week' ? 'line' : view}
          selected={selected}
          onSelect={setSelected}
        />
        {selectedDay && (
          <div className={styles.selection}>
            <strong>
              {t('workspace.day_count', {
                date: selectedDay.date,
                count: selectedDay.contributions,
              })}
            </strong>
            <span>{t('workspace.daily_only')}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                changeAnchor(selectedDay.date);
                setPeriod('day');
              }}
            >
              {t('workspace.view_day')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected('')}>
              {t('workspace.clear')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
