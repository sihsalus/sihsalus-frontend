import { Layer, Tile } from '@carbon/react';
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
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.helperText}>{helperText}</p>
        </Tile>
      </Layer>
    </div>
  );
};

export default InterconsultasEmptyState;
