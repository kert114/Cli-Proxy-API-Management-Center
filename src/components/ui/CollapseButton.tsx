import { useTranslation } from 'react-i18next';
import styles from './CollapseButton.module.scss';
export function CollapseButton({
  collapsed,
  onClick,
  label,
  controls,
}: {
  collapsed: boolean;
  onClick: () => void;
  label: string;
  controls: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.collapse}
      aria-label={t(collapsed ? 'workspace.expand' : 'workspace.collapse', { section: label })}
      aria-expanded={!collapsed}
      aria-controls={controls}
      onClick={onClick}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        aria-hidden="true"
        style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }}
      >
        <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </button>
  );
}
