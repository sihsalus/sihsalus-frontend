import { Button, Tile } from '@carbon/react';
import React from 'react';

import styles from './dental-empty-state.scss';

type DentalEmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
};

const DentalEmptyState: React.FC<DentalEmptyStateProps> = ({ title, description, actionLabel, onAction }) => {
  return (
    <div className={styles.wrapper}>
      <Tile className={styles.tile}>
        <h4 className={styles.title}>{title}</h4>
        <p className={styles.description}>{description}</p>
        {onAction && (
          <Button kind="ghost" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Tile>
    </div>
  );
};

export default DentalEmptyState;
