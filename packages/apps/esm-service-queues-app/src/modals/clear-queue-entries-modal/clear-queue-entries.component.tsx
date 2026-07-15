import { Button } from '@carbon/react';
import { TrashCan } from '@carbon/react/icons';
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
        disabled={queueEntries.length === 0}
        size={isDesktop(layout) ? 'sm' : 'lg'}
        kind="danger--ghost"
        onClick={launchClearAllQueueEntriesModal}
        iconDescription={t('clearQueueEntries', 'Clear queue entries')}
        renderIcon={TrashCan}
      >
        {t('clearQueueEntries', 'Clear queue entries')}
      </Button>
    </CanEditServiceQueues>
  );
};

export default ClearQueueEntries;
