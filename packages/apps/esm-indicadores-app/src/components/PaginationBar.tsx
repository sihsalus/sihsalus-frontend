import { Button } from '@carbon/react';
import React from 'react';

import styles from '../indicators-dashboard.module.scss';

interface PaginationBarProps {
  entityLabel: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const PaginationBar: React.FC<PaginationBarProps> = ({ entityLabel, page, pageSize, total, totalPages, onPageChange }) => {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className={styles.paginationBar}>
      <span className={styles.paginationSummary}>
        {start}-{end} de {total} {entityLabel}
      </span>
      <div className={styles.paginationActions}>
        <Button kind="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <span className={styles.paginationSummary}>Página {page} de {Math.max(1, totalPages)}</span>
        <Button kind="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
};

export default PaginationBar;
