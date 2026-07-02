import { Button, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { isDesktop, showModal, useLayoutType, useSession, userHasAccess } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { serviceQueuesEditPrivilege } from '../../constants';
import { type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

import styles from './queue-table-action-cell.scss';

export function QueueTableActionCell({ queueEntry }: QueueTableCellComponentProps) {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const session = useSession();
  const canEdit = userHasAccess(serviceQueuesEditPrivilege, session?.user);

  if (!canEdit) {
    return null;
  }

  return (
    <div className={styles.actionsCell}>
      <Button
        kind="ghost"
        aria-label={t('transition', 'Transition')}
        onClick={() => {
          const dispose = showModal('transition-queue-entry-modal', {
            closeModal: () => dispose(),
            queueEntry,
          });
        }}
        size={isDesktop(layout) ? 'sm' : 'lg'}
      >
        {t('transition', 'Transition')}
      </Button>
      <OverflowMenu aria-label="Actions menu" size={isDesktop(layout) ? 'sm' : 'lg'} align="left" flipped>
        <OverflowMenuItem
          className={styles.menuItem}
          aria-label={t('edit', 'Edit')}
          hasDivider
          onClick={() => {
            const dispose = showModal('edit-queue-entry-modal', {
              closeModal: () => dispose(),
              queueEntry,
            });
          }}
          itemText={t('edit', 'Edit')}
        />
        <OverflowMenuItem
          className={styles.menuItem}
          aria-label={t('removePatient', 'Remove patient')}
          hasDivider
          onClick={() => {
            const dispose = showModal('end-queue-entry-modal', {
              closeModal: () => dispose(),
              queueEntry,
              size: 'sm',
            });
          }}
          itemText={t('removePatient', 'Remove patient')}
        />
        {queueEntry.previousQueueEntry == null ? (
          <OverflowMenuItem
            className={styles.menuItem}
            aria-label={t('delete', 'Delete')}
            hasDivider
            isDelete
            onClick={() => {
              const dispose = showModal('void-queue-entry-modal', {
                closeModal: () => dispose(),
                queueEntry,
                size: 'sm',
              });
            }}
            itemText={t('delete', 'Delete')}
          />
        ) : (
          <OverflowMenuItem
            className={styles.menuItem}
            aria-label={t('undoTransition', 'Undo transition')}
            hasDivider
            isDelete
            onClick={() => {
              const dispose = showModal('undo-transition-queue-entry-modal', {
                closeModal: () => dispose(),
                queueEntry,
                size: 'sm',
              });
            }}
            itemText={t('undoTransition', 'Undo transition')}
          />
        )}
      </OverflowMenu>
    </div>
  );
}

export const queueTableActionColumn: QueueTableColumnFunction = (key, header) => ({
  key,
  header,
  CellComponent: QueueTableActionCell,
  getFilterableValue: null,
});
