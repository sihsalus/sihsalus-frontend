import { Button } from '@carbon/react';
import { Notification } from '@carbon/react/icons';
import { restBaseUrl, showModal, showNotification, useSession, userHasAccess } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';

import { type MappedVisitQueueEntry, serveQueueEntry } from '../active-visits/active-visits-table.resource';
import { serviceQueuesEditPrivilege } from '../constants';

import styles from './transition-entry.scss';

interface TransitionMenuProps {
  queueEntry: MappedVisitQueueEntry;
}

const TransitionMenu: React.FC<TransitionMenuProps> = ({ queueEntry }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(serviceQueuesEditPrivilege, session?.user);

  const launchTransitionPriorityModal = useCallback(() => {
    serveQueueEntry(queueEntry?.queue.name, queueEntry?.visitQueueNumber, 'calling').then(
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
          description: error?.message,
        });
      },
    );
    const dispose = showModal('transition-queue-entry-status-modal', {
      closeModal: () => dispose(),
      queueEntry,
    });
  }, [queueEntry, t]);

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
      iconDescription={t('call', 'Call')}
      hasIconOnly
      tooltipAlignment="end"
    />
  );
};

export default TransitionMenu;
