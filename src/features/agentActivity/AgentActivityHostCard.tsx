import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Meter } from '@/features/dashboard/components/Meter';
import type { MeterTone } from '@/features/dashboard/utils';
import { AGENT_STATES, type ActivityHost, type ActivityMetric } from '@/services/api/agentActivity';
import styles from './AgentActivityPage.module.scss';

const METRICS = ['cpu', 'memory', 'swap', 'disk'] as const;
const GIB = 1024 ** 3;

function MetricRow({
  metric,
  usage,
  detail,
  critical,
}: {
  metric: (typeof METRICS)[number];
  usage: ActivityMetric;
  detail?: string;
  critical: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { percent, cores, usedBytes, totalBytes, reason } = usage;
  const label = t(`agent_activity.metrics.${metric}`);
  const decimal = (value: number) =>
    value.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const amount =
    cores !== undefined
      ? t('agent_activity.cores', { count: cores })
      : usedBytes !== undefined && totalBytes !== undefined
        ? t('agent_activity.capacity', {
            used: decimal(usedBytes / GIB),
            total: decimal(totalBytes / GIB),
          })
        : undefined;
  const tone: MeterTone =
    critical || (percent ?? 0) > 90 ? 'critical' : (percent ?? 0) >= 70 ? 'warning' : 'good';

  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>
        {percent === undefined ? (
          <span className={styles.detail}>
            {reason
              ? t('agent_activity.unavailable_reason', { reason })
              : t('agent_activity.unavailable')}
          </span>
        ) : (
          <>
            <span className={styles.value}>
              {[t('agent_activity.percent', { value: decimal(percent) }), amount]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <Meter
              value={percent}
              tone={tone}
              ariaLabel={t('agent_activity.usage', { metric: label })}
            />
          </>
        )}
        {detail && <p className={styles.detail}>{detail}</p>}
      </dd>
    </div>
  );
}

export function AgentActivityHostCard({ host }: { host: ActivityHost }) {
  const { t, i18n } = useTranslation();
  const pressure = host.pressure?.memory;
  const memoryCritical =
    pressure !== undefined &&
    ('level' in pressure ? pressure.level === 4 : pressure.fullAvg10 >= 10);
  const available = (reason?: string) =>
    reason ? t('agent_activity.unavailable_reason', { reason }) : t('agent_activity.unavailable');
  const memoryDetail = pressure
    ? 'level' in pressure
      ? t('agent_activity.pressure_level', {
          level: t(`agent_activity.pressure_levels.${pressure.level}`, {
            defaultValue: String(pressure.level),
          }),
        })
      : t('agent_activity.pressure_stalls', {
          some: pressure.someAvg10.toLocaleString(i18n.language, { minimumFractionDigits: 2 }),
          full: pressure.fullAvg10.toLocaleString(i18n.language, { minimumFractionDigits: 2 }),
        })
    : host.pressure?.memoryReason
      ? t('agent_activity.pressure_unavailable', { reason: host.pressure.memoryReason })
      : undefined;
  const load = host.pressure?.load;
  const cores = host.cpu.cores;
  const decimal = (value: number) =>
    value.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const loadDetail =
    load === undefined ? undefined : t('agent_activity.load', { value: decimal(load) });
  const cpuDetail =
    load !== undefined && cores && load > cores
      ? t('agent_activity.load_oversubscribed', { load: loadDetail, ratio: decimal(load / cores) })
      : loadDetail;
  const sampledAt =
    host.sampledAt === undefined
      ? undefined
      : t('agent_activity.sampled', {
          time: new Date(host.sampledAt).toLocaleTimeString(i18n.language),
        });
  const hostDetails = [host.host === host.name ? undefined : host.host, host.os, sampledAt]
    .filter(Boolean)
    .join(' · ');
  const { queued, running, reason: jobsReason } = host.jobs;
  const jobs = [
    ...(queued ?? []).map((job) => ({ ...job, status: 'queued' as const })),
    ...(running ?? []).map((job) => ({ ...job, status: 'running' as const })),
  ];

  return (
    <article className={styles.host}>
      <Card title={<h2>{host.name}</h2>}>
        {hostDetails && <p className={styles.detail}>{hostDetails}</p>}
        {host.unavailable && <p className={styles.notice}>{available(host.reason)}</p>}
        {host.stale && <p className={styles.notice}>{t('agent_activity.stale')}</p>}
        {host.hasSnapshot && (
          <>
            <dl className={styles.metrics}>
              {METRICS.map((metric) => (
                <MetricRow
                  key={metric}
                  metric={metric}
                  usage={host[metric]}
                  detail={
                    metric === 'cpu' ? cpuDetail : metric === 'memory' ? memoryDetail : undefined
                  }
                  critical={metric === 'memory' && memoryCritical}
                />
              ))}
            </dl>
            <section className={styles.section}>
              <h3>{t('agent_activity.agents')}</h3>
              {host.agents.counts ? (
                <dl className={styles.counts}>
                  {AGENT_STATES.map((state) => {
                    const count = host.agents.counts?.[state];
                    return (
                      count !== undefined && (
                        <div key={state}>
                          <dt>{t(`agent_activity.agent_states.${state}`)}</dt>
                          <dd>{count.toLocaleString(i18n.language)}</dd>
                        </div>
                      )
                    );
                  })}
                </dl>
              ) : (
                <p className={styles.detail}>{available(host.agents.reason)}</p>
              )}
            </section>
            <section className={styles.section}>
              <h3>{t('agent_activity.jobs')}</h3>
              {jobs.length > 0 && (
                <ul className={styles.jobs}>
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <strong>
                        {[job.label, job.repo].filter(Boolean).join(' · ') ||
                          t('agent_activity.unnamed_job')}
                      </strong>
                      <span className={job.status === 'queued' ? styles.notice : styles.detail}>
                        {[t(`agent_activity.agent_states.${job.status}`), job.waitReason]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {running && queued && jobs.length === 0 && (
                <p className={styles.detail}>{t('agent_activity.no_jobs')}</p>
              )}
              {!running && !queued ? (
                <p className={styles.detail}>{available(jobsReason)}</p>
              ) : (
                <>
                  {!running && (
                    <p className={styles.detail}>{t('agent_activity.running_jobs_unavailable')}</p>
                  )}
                  {!queued && (
                    <p className={styles.detail}>{t('agent_activity.queued_jobs_unavailable')}</p>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </Card>
    </article>
  );
}
