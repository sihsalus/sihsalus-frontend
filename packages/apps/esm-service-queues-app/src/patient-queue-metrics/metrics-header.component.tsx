import { ComboButton, MenuItem } from '@carbon/react';
import {
  isDesktop,
  launchWorkspace,
  navigate,
  showModal,
  UserHasAccess,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { serviceQueuesBasePath, serviceQueuesEditPrivilege } from '../constants';

import styles from './metrics-header.scss';

const MetricsHeader = () => {
  const { t } = useTranslation();
  const currentUserSession = useSession();
  const layout = useLayoutType();

  const metricsTitle = t('clinicMetrics', 'Clinic metrics');
  const queueScreenText = t('queueScreen', 'Call display');
  const providerUuid = currentUserSession?.currentProvider?.uuid;
  const canEdit = userHasAccess(serviceQueuesEditPrivilege, currentUserSession?.user);

  const launchAddProviderToRoomModal = useCallback(() => {
    const dispose = showModal('add-provider-to-room-modal', {
      closeModal: () => dispose(),
      providerUuid,
    });
  }, [providerUuid]);

  const navigateToQueueScreen = useCallback(() => {
    navigate({ to: `${serviceQueuesBasePath}/screen` });
  }, []);

  return (
    <div className={styles.metricsContainer}>
      <span className={styles.metricsTitle}>{metricsTitle}</span>
      <ComboButton
        className={styles.comboBtn}
        label={queueScreenText}
        menuAlignment="bottom-end"
        onClick={navigateToQueueScreen}
        size={isDesktop(layout) ? 'sm' : 'lg'}
        tooltipAlignment="left"
      >
        {canEdit ? (
          <UserHasAccess privilege="Emr: View Legacy Interface">
            <MenuItem
              label={t('addNewService', 'Add new service')}
              onClick={() => launchWorkspace('service-queues-service-form')}
            />
            <MenuItem
              label={t('addNewServiceRoom', 'Add new service room')}
              onClick={() => launchWorkspace('service-queues-room-workspace')}
            />
          </UserHasAccess>
        ) : null}
        {canEdit ? (
          <MenuItem
            label={t('addProviderQueueRoom', 'Add provider queue room')}
            onClick={launchAddProviderToRoomModal}
          />
        ) : null}
      </ComboButton>
    </div>
  );
};

export default MetricsHeader;
