import { Button } from '@carbon/react';
import { isDesktop, showModal, useLayoutType } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CanEditServiceQueues } from '../../permissions';
import { type QueueEntry } from '../../types';

interface ClearQueueEntriesProps {
  queueEntries: Array<QueueEntry>;
}

/** Button to end all queue entries in a queue table. */
const ClearQueueEntries: React.FC<ClearQueueEntriesProps> = ({ queueEntries }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();

  const launchClearAllQueueEntriesModal = useCallback(() => {
    const dispose = showModal('clear-all-queue-entries-modal', {
      closeModal: () => dispose(),
      queueEntries,
    });
  }, [queueEntries]);

  return (
    <CanEditServiceQueues>
      <Button
        size={isDesktop(layout) ? 'sm' : 'lg'}
        kind="tertiary"
        onClick={launchClearAllQueueEntriesModal}
        iconDescription={t('clearQueueEntries', 'Clear queue entries')}
      >
        {t('clearQueueEntries', 'Clear queue entries')}
      </Button>
    </CanEditServiceQueues>
  );
};

export default ClearQueueEntries;
