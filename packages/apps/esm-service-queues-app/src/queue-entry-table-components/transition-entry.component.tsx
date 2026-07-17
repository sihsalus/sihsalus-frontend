import { Button } from '@carbon/react';
import { Notification } from '@carbon/react/icons';
import {
  getUserFacingErrorMessage,
  restBaseUrl,
  showModal,
  showNotification,
  useSession,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';

import { type MappedVisitQueueEntry, serveQueueEntry } from '../active-visits/active-visits-table.resource';
import { canEditServiceQueues } from '../permissions';

import styles from './transition-entry.scss';

interface TransitionMenuProps {
  queueEntry: MappedVisitQueueEntry;
}

const TransitionMenu: React.FC<TransitionMenuProps> = ({ queueEntry }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = canEditServiceQueues(session?.user);
  const ticketNumber = queueEntry.visitQueueNumber?.trim();
  const hasTicketNumber = Boolean(ticketNumber);

  const launchTransitionPriorityModal = useCallback(() => {
    if (!ticketNumber) {
      return;
    }

    serveQueueEntry(queueEntry.queue.name, ticketNumber, 'calling').then(
      ({ status }) => {
        if (status === 200) {
          mutate(`${restBaseUrl}/queueutil/assignticket`);
        }
      },
      (error) => {
        showNotification({
          title: t('errorPostingToScreen', 'Error posting to screen'),
          kind: 'error',
          critical: true,
          description: getUserFacingErrorMessage(
            error,
            t('queueScreenPostErrorMessage', 'The patient could not be sent to the queue screen. Please try again.'),
            { logContext: 'Post queue entry to calling screen' },
          ),
        });
      },
    );
    const dispose = showModal('transition-queue-entry-status-modal', {
      closeModal: () => dispose(),
      queueEntry,
    });
  }, [queueEntry, t, ticketNumber]);

  if (!canEdit) {
    return null;
  }

  return (
    <Button
      renderIcon={(props) => <Notification size={16} {...props} />}
      className={classNames(styles.callBtn, {
        [styles.requeueIcon]: queueEntry?.priorityComment === 'Requeued',
        [styles.normalIcon]: queueEntry?.priorityComment !== 'Requeued',
      })}
      onClick={launchTransitionPriorityModal}
      iconDescription={
        hasTicketNumber ? t('call', 'Call') : t('callUnavailableWithoutTicket', 'Call unavailable: no queue number')
      }
      disabled={!hasTicketNumber}
      hasIconOnly
      tooltipAlignment="end"
    />
  );
};

export default TransitionMenu;
