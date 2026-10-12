import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QuotaPage } from '@/features/quota/QuotaPage';
import { GitHubActivity } from './activity/GitHubActivity';
import styles from './WorkDashboard.module.scss';

export function DashboardPage() {
  const { t } = useTranslation();
  const [githubRefresh, setGitHubRefresh] = useState(0);
  const refreshGitHub = useCallback(() => setGitHubRefresh((value) => value + 1), []);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{t('work_dashboard.title')}</h1>
          <p>{t('work_dashboard.description')}</p>
        </div>
        <Link to="/dashboard/proxy">{t('work_dashboard.proxy_overview')}</Link>
      </header>
      <GitHubActivity refreshToken={githubRefresh} />
      <QuotaPage embedded onRefreshExtra={refreshGitHub} />
    </div>
  );
}
