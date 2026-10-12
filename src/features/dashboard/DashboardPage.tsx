import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ACTIVITY_PERIODS, type ActivityPeriod } from './activity/window';
import { QuotaPage } from '@/features/quota/QuotaPage';
import { GitHubActivity } from './activity/GitHubActivity';
import styles from './WorkDashboard.module.scss';

export function DashboardPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ActivityPeriod>('week');
  const [githubRefresh, setGitHubRefresh] = useState(0);
  const refreshGitHub = useCallback(() => setGitHubRefresh((value) => value + 1), []);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{t('work_dashboard.title')}</h1>
          <p>{t('work_dashboard.description')}</p>
        </div>
        <div className={styles.viewControls}>
          <span className={styles.periodLabel}>{t('work_dashboard.period')}</span>
          <div className={styles.periodSwitch} role="group" aria-label={t('work_dashboard.period')}>
            {ACTIVITY_PERIODS.map((view) => (
              <Button
                key={view}
                variant={period === view ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={period === view}
                onClick={() => setPeriod(view)}
              >
                {t(`work_dashboard.${view}`)}
              </Button>
            ))}
          </div>
          <Link to="/dashboard/proxy">{t('work_dashboard.proxy_overview')}</Link>
        </div>
      </header>
      <GitHubActivity period={period} refreshToken={githubRefresh} />
      <QuotaPage embedded onRefreshExtra={refreshGitHub} />
    </div>
  );
}
