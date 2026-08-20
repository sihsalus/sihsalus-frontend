import type { SyncItem } from '@openmrs/esm-framework/src/internal';
import {
  deleteSynchronizationItem,
  getOfflineSynchronizationStore,
  showModal,
  showSnackbar,
  useStore,
} from '@openmrs/esm-framework/src/internal';
import React from 'react';
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
  const { data: syncItems, mutate } = usePendingSyncItems();
  const { data: syncItemPatients } = useSyncItemPatients(syncItems);
  const syncItemsToRender = patientUuid
    ? syncItems?.filter((x) => x.descriptor.patientUuid === patientUuid)
    : syncItems;
  const syncItemsTableData = getSyncItemsWithPatient(syncItemsToRender, syncItemPatients);
  const isLoading = !syncItems || !syncItemPatients;
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
      {isLoading || syncItems?.length > 0 ? (
        <OfflineActionsTable
          isLoading={isLoading}
          data={syncItemsTableData}
          hiddenHeaders={patientUuid ? ['patient'] : []}
          disableEditing={isSynchronizing}
          disableDelete={false}
          onDelete={deleteSynchronizationItems}
        />
      ) : (
        <NoActionsEmptyState />
      )}
    </>
  );
};

function getSyncItemsWithPatient(syncItems: Array<SyncItem> = [], patients: Array<fhir.Patient> = []) {
  return syncItems.map((item) => ({
    item,
    patient: patients.find((patient) => patient.id === item.descriptor?.patientUuid),
  }));
}

export default OfflineActions;
