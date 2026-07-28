import { Layer, Tile } from '@carbon/react';
import { useLayoutType } from '@openmrs/esm-framework';
import React from 'react';
import { EmptyDataIllustration } from './empty-data-illustration';
import styles from './styles.scss';

export interface EmptyStateProps {
  headerTitle: string;
  displayText: string;
}
const EmptyState: React.FC<EmptyStateProps> = ({ headerTitle, displayText }) => {
  const isTablet = useLayoutType() === 'tablet';

  return (
    <Layer>
      <Tile className={styles.tile}>
        <div className={isTablet ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{headerTitle}</h4>
        </div>
        <EmptyDataIllustration />
        <p className={styles.content}>{displayText}</p>
      </Tile>
    </Layer>
  );
};

export default EmptyState;
export { EmptyState };
