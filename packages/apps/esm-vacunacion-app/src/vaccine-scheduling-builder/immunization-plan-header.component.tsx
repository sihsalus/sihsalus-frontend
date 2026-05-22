import { Location, UserFollow } from '@carbon/react/icons';
import { useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './immunization-plan-header.scss';
import ImmunizationIllustration from './immunization-plan-illustration.component';

interface ImmunizationPlanHeaderProps {
  title: string;
}

const ImmunizationPlanHeader: React.FC<ImmunizationPlanHeaderProps> = ({ title }) => {
  const { t } = useTranslation();
  const session = useSession();
  const location = session?.sessionLocation?.display;

  return (
    <div className={styles.header} data-testid="immunization-plan-header">
      <div className={styles.leftJustifiedItems}>
        <ImmunizationIllustration />
        <div className={styles.pageLabels}>
          <p>{t('immunization', 'Vacunación')}</p>
          <p className={styles.pageName}>{title}</p>
        </div>
      </div>
      <div className={styles.rightJustifiedItems}>
        <div className={styles.userContainer}>
          <p>{session?.user?.person?.display}</p>
          <UserFollow size={16} className={styles.userIcon} />
        </div>
        {location && (
          <div className={styles.dateAndLocation}>
            <Location size={16} />
            <span className={styles.value}>{location}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImmunizationPlanHeader;
