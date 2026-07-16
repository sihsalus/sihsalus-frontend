import { Layer, Tile } from '@carbon/react';
import { DocumentTasks } from '@carbon/react/icons';
import React from 'react';
import styles from './interconsultas-empty-state.scss';

interface InterconsultasEmptyStateProps {
  title: string;
  helperText: string;
}

const InterconsultasEmptyState: React.FC<InterconsultasEmptyStateProps> = ({ title, helperText }) => {
  return (
    <div className={styles.emptyStateContainer}>
      <Layer className={styles.layer}>
        <Tile className={styles.card} role="status" aria-atomic="true" aria-live="polite">
          <div className={styles.iconContainer} aria-hidden="true">
            <DocumentTasks size={24} />
          </div>
          <div className={styles.content}>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.helperText}>{helperText}</p>
          </div>
        </Tile>
      </Layer>
    </div>
  );
};

export default InterconsultasEmptyState;
