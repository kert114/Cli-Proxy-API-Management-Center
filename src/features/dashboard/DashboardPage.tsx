import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QuotaPage } from '@/features/quota/QuotaPage';
import { StatisticsPanel } from './workspace/StatisticsPanel';
import { PullsPanel } from './workspace/PullsPanel';
import styles from './WorkDashboard.module.scss';

export function DashboardPage() {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{t('workspace.title')}</h1>
          <p>{t('workspace.description')}</p>
        </div>
        <Link to="/dashboard/proxy">{t('work_dashboard.proxy_overview')}</Link>
      </header>
      <QuotaPage embedded />
      <StatisticsPanel />
      <PullsPanel />
    </div>
  );
}
