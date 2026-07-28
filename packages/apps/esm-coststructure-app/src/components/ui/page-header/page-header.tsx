// ui/PageHeader.tsx
import React from 'react';

import styles from './page-header.scss';

interface Props {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function PageHeader({ icon, title, subtitle }: Props) {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <div className={styles.icon}>{icon || <div className={styles.placeholderIcon} />}</div>
        <div>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          <h1 className={styles.title}>{title}</h1>
        </div>
      </div>
    </div>
  );
}
