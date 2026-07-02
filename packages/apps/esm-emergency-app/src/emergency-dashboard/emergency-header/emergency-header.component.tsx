import { Button } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import {
  isDesktop,
  launchWorkspace,
  PageHeader,
  PageHeaderContent,
  ServiceQueuesPictogram,
  useLayoutType,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { emergencyEditPrivilege } from '../../constants';
import { emergencyWorkflowWorkspace } from '../../emergency-workflow/constants';
import styles from './emergency-header.scss';

/**
 * Emergency Header Component
 *
 * Displays the header with title, pictogram, and action button
 * to launch the emergency workflow workspace.
 */
interface EmergencyHeaderProps {
  queueFilter?: React.ReactNode;
}

const EmergencyHeader: React.FC<EmergencyHeaderProps> = ({ queueFilter }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const session = useSession();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'md';
  const canEdit = userHasAccess(emergencyEditPrivilege, session?.user);

  const handleNewPatientClick = () => {
    launchWorkspace(emergencyWorkflowWorkspace, {
      workspaceTitle: t('newEmergencyPatient', 'New Emergency Patient'),
    });
  };

  return (
    <PageHeader className={styles.pageHeader}>
      <PageHeaderContent
        title={t('emergencyDepartment', 'Emergency Services')}
        illustration={<ServiceQueuesPictogram />}
      />
      <div className={styles.headerActions}>
        {queueFilter}
        {canEdit && (
          <Button
            kind="primary"
            renderIcon={(props) => <Add size={16} {...props} />}
            onClick={handleNewPatientClick}
            size={responsiveSize}
            className={styles.newPatientButton}
          >
            {t('newEmergencyPatient', 'New Emergency Patient')}
          </Button>
        )}
      </div>
    </PageHeader>
  );
};

export default EmergencyHeader;
