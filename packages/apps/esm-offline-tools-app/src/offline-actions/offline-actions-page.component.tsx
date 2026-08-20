import { Button } from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import {
  getOfflineSynchronizationStore,
  isDesktop,
  runSynchronization,
  showSnackbar,
  useConnectivity,
  useLayoutType,
  useStore,
} from '@openmrs/esm-framework/src/internal';
import React from 'react';
import { useTranslation } from 'react-i18next';

import SharedPageLayout from '../components/shared-page-layout.component';
import { usePendingSyncItems } from '../hooks/offline-actions';
import OfflineActions from './offline-actions.component';
import styles from './offline-actions-page.styles.scss';

const OfflineActionsPage: React.FC = () => {
  const { t } = useTranslation();
  const canSynchronizeOfflineActions = useConnectivity();
  const layout = useLayoutType();
  const syncStore = useStore(getOfflineSynchronizationStore());
  const { mutate: mutatePendingSyncItems } = usePendingSyncItems();
  const isSynchronizing = !!syncStore.synchronization;

  const synchronize = () => {
    void runSynchronization()
      .catch(() => {
        showSnackbar({
          kind: 'error',
          title: t('offlineActionsSynchronizationFailed', 'Offline actions were not fully synchronized'),
          subtitle: t(
            'offlineActionsSynchronizationFailedSubtitle',
            'Pending actions were kept. Verify the session and connection, then try again.',
          ),
        });
      })
      .then(() => mutatePendingSyncItems())
      .catch(() => {
        showSnackbar({
          kind: 'error',
          title: t('offlineActionsRefreshFailed', 'Pending actions could not be refreshed'),
          subtitle: t(
            'offlineActionsRefreshFailedSubtitle',
            'The local queue may have changed. Reload this page before taking another action.',
          ),
        });
      });
  };

  const primaryActions = (
    <Button
      className={styles.primaryActionButton}
      size={isDesktop(layout) ? 'sm' : undefined}
      renderIcon={(props) => isDesktop(layout) && <Renew size={16} {...props} />}
      disabled={isSynchronizing}
      onClick={synchronize}
    >
      {!isDesktop(layout) && <Renew size={16} className={styles.buttonInlineIcon} />}
      {t('offlineActionsUpdateOfflinePatients', 'Update offline patients')}
    </Button>
  );

  return (
    <SharedPageLayout
      header={t('offlineActionsHeader', 'Offline actions')}
      primaryActions={canSynchronizeOfflineActions ? primaryActions : undefined}
    >
      <div className={styles.contentContainer}>
        <OfflineActions />
      </div>
    </SharedPageLayout>
  );
};

export default OfflineActionsPage;
