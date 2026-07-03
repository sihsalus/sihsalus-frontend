import { Button } from '@carbon/react';
import { TaskAdd } from '@carbon/react/icons';
import { launchWorkspace, useSession, userHasAccess } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { caseMonitoringEditPrivilege } from '../../utils/constants';
import styles from './case-management-header.scss';

interface MetricsHeaderProps {
  activeTabIndex: number;
}

const MetricsHeader: React.FC<MetricsHeaderProps> = ({ activeTabIndex }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(caseMonitoringEditPrivilege, session?.user);
  const handleAddCase = () => {
    launchWorkspace('case-management-form', {
      workspaceTitle: t('caseManagementFormTitle', 'Patient Tracking Form'),
    });
  };

  const isDiscontinuationTab = activeTabIndex === 1;

  return (
    <div className={styles.metricsContainer}>
      <div className={styles.actionBtn}>
        {canEdit ? (
          <Button
            kind="tertiary"
            renderIcon={(props) => <TaskAdd size={16} {...props} />}
            iconDescription={t('addCase', 'Add case')}
            onClick={handleAddCase}
            disabled={isDiscontinuationTab}
          >
            {t('addCase', 'Add case')}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default MetricsHeader;
