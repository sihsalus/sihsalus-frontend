import { DataTableSkeleton } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import PatientQueueHeader from '../patient-queue-header/patient-queue-header.component';

import styles from './queue-screen.scss';
import { useActiveTickets } from './useActiveTickets';

type QueueScreenProps = {};

const QueueScreen: React.FC<QueueScreenProps> = () => {
  const { t } = useTranslation();
  const { activeTickets, isLoading, error } = useActiveTickets();
  const title = t('queueScreen', 'Call display');

  if (isLoading) {
    return <DataTableSkeleton rowCount={5} className={styles.queueScreen} role="progressbar" />;
  }

  const rowData = activeTickets.map((ticket, index) => ({
    id: `${ticket.room}-${ticket.ticketNumber}-${index}`,
    room: ticket.room,
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
  }));

  return (
    <div>
      <PatientQueueHeader title={title} showLocationDropdown />
      {error ? (
        <div className={styles.feedback}>{t('errorLoadingQueueEntries', 'Error loading queue entries')}</div>
      ) : null}
      {!error && rowData.length === 0 ? (
        <div className={styles.feedback}>
          <h4>{t('queueScreenNoPatients', 'No called patients')}</h4>
          <p>{t('queueScreenEmptyDescription', 'Patients called from the service queue will appear here.')}</p>
        </div>
      ) : null}
      <div className={styles.gridFlow}>
        {rowData.map((row) => (
          <div className={styles.card} key={row.id}>
            <p className={styles.subHeader}>{t('ticketNumber', 'Ticket number')}</p>
            <p className={row.status === 'calling' ? styles.headerBlinking : styles.header}>{row.ticketNumber}</p>
            <p className={styles.subHeader}>
              {t('attentionRoom', 'Room')} &nbsp; : &nbsp; {row.room}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueueScreen;
