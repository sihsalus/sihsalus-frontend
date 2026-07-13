import { DropdownSkeleton, InlineNotification } from '@carbon/react';
import { type Visit } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserFacingErrorMessage } from '../../hooks/useUserFacingErrorMessage';
import MoveQueueEntryModal from '../move-queue-entry.modal';
import AddPatientToQueueModal from './add-patient-to-queue.component';
import { useLatestQueueEntry } from './useLatestQueueEntry';

interface AddOrMoveModalProps {
  activeVisit: Visit;
  closeModal: () => void;
}

const AddOrMoveModal: React.FC<AddOrMoveModalProps> = ({ closeModal, activeVisit }) => {
  const patientUuid = activeVisit?.patient?.uuid;
  const { t } = useTranslation();
  const { data: queueEntry, isLoading, error } = useLatestQueueEntry(patientUuid);
  const errorMessage = useUserFacingErrorMessage(
    error,
    t('queueDataLoadErrorMessage', 'Queue information could not be loaded. Please try again.'),
    'Load latest queue entry',
  );

  if (isLoading) {
    return <DropdownSkeleton />;
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        title={t('errorLoadingQueueEntry', 'Error loading queue entry')}
        subtitle={errorMessage}
        lowContrast
      />
    );
  }

  return (
    <>
      {queueEntry ? (
        // TODO: I don't know whether this is supposed to be used to change which queue
        // the patient is in (move) or to update the patient's status (transition).
        // I think this is a Palladium thing.
        // https://github.com/openmrs/openmrs-esm-patient-management/pull/1516
        <MoveQueueEntryModal queueEntry={queueEntry} closeModal={closeModal} />
      ) : (
        <AddPatientToQueueModal
          modalTitle={t('addPatientToQueue', 'Add patient to queue')}
          activeVisit={activeVisit}
          closeModal={closeModal}
        />
      )}
    </>
  );
};

export default AddOrMoveModal;
