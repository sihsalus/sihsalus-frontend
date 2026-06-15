import { Calendar, Location } from '@carbon/react/icons';
import { Assessment1Pictogram, formatDate, PageHeader, PageHeaderContent, useSession } from '@openmrs/esm-framework';
import React from 'react';

import styles from './case-management-header.scss';

interface ClaimManagementHeaderProps {
  title: string;
}

export const ClaimManagementHeader: React.FC<ClaimManagementHeaderProps> = ({ title }) => {
  const userSession = useSession();
  const userLocation = userSession?.sessionLocation?.display;

  return (
    <PageHeader className={styles.header}>
      <PageHeaderContent title={title} illustration={<Assessment1Pictogram />} />
      <div className={styles.rightJustifiedItems}>
        <div className={styles.dateAndLocation}>
          <Location size={16} />
          <span className={styles.value}>{userLocation}</span>
          <span className={styles.middot}>&middot;</span>
          <Calendar size={16} />
          <span className={styles.value}>{formatDate(new Date(), { mode: 'standard' })}</span>
        </div>
      </div>
    </PageHeader>
  );
};
