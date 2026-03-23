import { ReactNode } from 'react';
import styles from './StatusRow.module.css';

type StatusType = 'ready' | 'missing' | 'optional' | 'loading';

interface StatusRowProps {
  label: string;
  status: StatusType;
  detail?: string;
  icon?: ReactNode;
}

export function StatusRow({ label, status, detail, icon }: StatusRowProps) {
  return (
    <div className={`${styles.row} ${styles[status]}`}>
      <div className={styles.icon}>{icon}</div>
      <span className={styles.label}>{label}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  );
}
