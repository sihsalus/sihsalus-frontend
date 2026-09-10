import { Button, InlineNotification } from '@carbon/react';
import type { SyncItem } from '@openmrs/esm-framework/src/internal';
import {
  deleteSynchronizationItem,
  getOfflineSynchronizationStore,
  showModal,
  showSnackbar,
  useStore,
} from '@openmrs/esm-framework/src/internal';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePendingSyncItems, useSyncItemPatients } from '../hooks/offline-actions';

import NoActionsEmptyState from './no-actions-empty-state.component';
import OfflineActionsTable from './offline-actions-table.component';

export interface OfflineActionsProps {
  /**
   * If specified, shows a single patient's offline actions only.
   */
  patientUuid?: string;
}

const OfflineActions: React.FC<OfflineActionsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const syncStore = useStore(getOfflineSynchronizationStore());
  const { data: syncItems, error: queueError, mutate } = usePendingSyncItems();
  const { data: syncItemPatients, error: patientsError, mutate: refreshPatients } = useSyncItemPatients(syncItems);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryPending = useRef(false);
  const retry = async () => {
    if (retryPending.current) return;
    retryPending.current = true;
    setIsRetrying(true);
    try {
      await Promise.allSettled([
        Promise.resolve().then(() => mutate()),
        Promise.resolve().then(() => refreshPatients()),
      ]);
    } finally {
      retryPending.current = false;
      setIsRetrying(false);
    }
  };
  const syncItemsToRender = patientUuid
    ? syncItems?.filter((x) => x.descriptor?.patientUuid === patientUuid)
    : syncItems;
  const syncItemsTableData = getSyncItemsWithPatient(syncItemsToRender, syncItemPatients);
  const isLoading = !syncItems && !queueError;
  const isSynchronizing = !!syncStore.synchronization;

  const deleteSynchronizationItems = (ids: Array<number>) => {
    const closeModal = showModal('offline-tools-confirmation-modal', {
      title: t('offlineActionsDeleteConfirmationModalTitle', 'Delete offline actions'),
      children: t(
        'offlineActionsDeleteConfirmationModalContent',
        'Are you sure that you want to delete all selected offline actions? This cannot be undone!',
      ),
      confirmText: t('offlineActionsDeleteConfirmationModalConfirm', 'Delete forever'),
      cancelText: t('offlineActionsDeleteConfirmationModalCancel', 'Cancel'),
      closeModal: () => closeModal(),
      onConfirm: () => {
        void (async () => {
          const deleteResults = await Promise.allSettled(
            ids.map((id) => Promise.resolve().then(() => deleteSynchronizationItem(id))),
          );
          const failedCount = deleteResults.filter((result) => result.status === 'rejected').length;
          const [refreshResult] = await Promise.allSettled([Promise.resolve().then(() => mutate())]);

          // A deletion failure takes precedence so one destructive action
          // produces only one actionable, non-technical notification.
          if (failedCount > 0) {
            showSnackbar({
              kind: 'error',
              title: t('offlineActionsDeleteFailed', 'Some offline actions could not be deleted'),
              subtitle: t(
                'offlineActionsDeleteFailedSubtitle',
                '{{count}} action(s) failed to delete and are still listed.',
                { count: failedCount },
              ),
            });
          } else if (refreshResult.status === 'rejected') {
            showSnackbar({
              kind: 'warning',
              title: t('offlineActionsDeleteRefreshFailed', 'Pending actions could not be refreshed'),
              subtitle: t(
                'offlineActionsDeleteRefreshFailedSubtitle',
                'The deletion completed, but this page may be out of date. Reload it before taking another action.',
              ),
            });
          }
        })();
      },
    });
  };

  return (
    <>
      {(queueError || patientsError) && (
        <div>
          <InlineNotification
            role="alert"
            kind={queueError ? 'error' : 'warning'}
            hideCloseButton
            title={
              queueError
                ? t('offlineActionsLoadFailed', 'Pending actions could not be loaded')
                : t('offlineActionsPatientsLoadFailed', 'Some patient details could not be loaded')
            }
            subtitle={t(
              'offlineActionsLoadFailedMessage',
              'Your pending actions have not been deleted. Verify your session and connection, then retry.',
            )}
          />
          <Button kind="tertiary" onClick={retry} disabled={isRetrying}>
            {t('retry', 'Retry')}
          </Button>
        </div>
      )}
      {isLoading || syncItemsToRender?.length > 0 ? (
        <OfflineActionsTable
          isLoading={isLoading}
          data={syncItemsTableData}
          hiddenHeaders={patientUuid ? ['patient'] : []}
          disableEditing={isSynchronizing || !!queueError}
          disableDelete={false}
          onDelete={deleteSynchronizationItems}
        />
      ) : !queueError && syncItems ? (
        <NoActionsEmptyState />
      ) : null}
    </>
  );
};

function getSyncItemsWithPatient(syncItems: Array<SyncItem> = [], patients: Array<fhir.Patient> = []) {
  return syncItems.map((item) => ({
    item,
    patient: patients.find((patient) => patient?.id === item.descriptor?.patientUuid),
  }));
}

export default OfflineActions;
