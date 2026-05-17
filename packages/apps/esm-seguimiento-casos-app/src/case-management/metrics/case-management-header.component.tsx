import { Button } from '@carbon/react';
import { WatsonHealthStressBreathEditor } from '@carbon/react/icons';
import { launchWorkspace } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './case-management-header.scss';

interface MetricsHeaderProps {
  activeTabIndex: number;
}

const MetricsHeader: React.FC<MetricsHeaderProps> = ({ activeTabIndex }) => {
  const { t } = useTranslation();
  const handleAddCase = () => {
    launchWorkspace('case-management-form', {
      workspaceTitle: t('caseManagementFormTitle', 'Patient Tracking Form'),
    });
  };

  const isDiscontinuationTab = activeTabIndex === 1;

  return (
    <div className={styles.metricsContainer}>
      <div className={styles.actionBtn}>
        <Button
          kind="tertiary"
          renderIcon={(props) => <WatsonHealthStressBreathEditor size={16} {...props} />}
          iconDescription={t('addCase', 'Add case')}
          onClick={handleAddCase}
          disabled={isDiscontinuationTab}
        >
          {t('addCase', 'Add case')}
        </Button>
      </div>
    </div>
  );
};

export default MetricsHeader;
