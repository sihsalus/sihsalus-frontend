import { ComboButton, MenuItem } from '@carbon/react';
import {
  isDesktop,
  launchWorkspace,
  navigate,
  showModal,
  UserHasAccess,
  useLayoutType,
  useSession,
} from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { spaBasePath } from '../constants';

import styles from './metrics-header.scss';

const MetricsHeader = () => {
  const { t } = useTranslation();
  const currentUserSession = useSession();
  const layout = useLayoutType();

  const metricsTitle = t('clinicMetrics', 'Clinic metrics');
  const queueScreenText = t('queueScreen', 'Queue screen');
  const providerUuid = currentUserSession?.currentProvider?.uuid;

  const launchAddProviderToRoomModal = useCallback(() => {
    const dispose = showModal('add-provider-to-room-modal', {
      closeModal: () => dispose(),
      providerUuid,
    });
  }, [providerUuid]);

  const navigateToQueueScreen = useCallback(() => {
    navigate({ to: `${spaBasePath}/service-queues/screen` });
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
        <MenuItem label={t('addProviderQueueRoom', 'Add provider queue room')} onClick={launchAddProviderToRoomModal} />
      </ComboButton>
    </div>
  );
};

export default MetricsHeader;
