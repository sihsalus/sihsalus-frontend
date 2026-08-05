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

  const deleteSynchronizationItems = async (ids: Array<number>) => {
    const closeModal = showModal('offline-tools-confirmation-modal', {
      title: t('offlineActionsDeleteConfirmationModalTitle', 'Delete offline actions'),
      children: t(
        'offlineActionsDeleteConfirmationModalContent',
        'Are you sure that you want to delete all selected offline actions? This cannot be undone!',
      ),
      confirmText: t('offlineActionsDeleteConfirmationModalConfirm', 'Delete forever'),
      cancelText: t('offlineActionsDeleteConfirmationModalCancel', 'Cancel'),
      closeModal: () => closeModal(),
      onConfirm: async () => {
        const results = await Promise.allSettled(ids.map((id) => deleteSynchronizationItem(id)));
        const failedCount = results.filter((result) => result.status === 'rejected').length;

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
        }

        mutate();
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
