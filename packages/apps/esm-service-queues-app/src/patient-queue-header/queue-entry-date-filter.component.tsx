import { Button } from '@carbon/react';
import { OpenmrsDatePicker } from '@openmrs/esm-framework';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { parseQueueEntryDate } from '../store/queue-entry-date';
import { updateSelectedQueueEntryDate, useServiceQueuesStore } from '../store/store';
import styles from './patient-queue-header.scss';

export default function QueueEntryDateFilter() {
  const { t } = useTranslation();
  const id = useId();
  const { selectedQueueEntryDate } = useServiceQueuesStore();
  const date = parseQueueEntryDate(selectedQueueEntryDate);

  return (
    <div className={styles.dateFilter}>
      <OpenmrsDatePicker
        id={`${id}-queue-entry-date`}
        labelText={t('queueEntryDate', 'Queue entry date')}
        value={date}
        onChange={updateSelectedQueueEntryDate}
        size="md"
      />
      <div className={styles.dateActions}>
        {!date && <span>{t('allQueueEntryDates', 'All dates')}</span>}
        <Button kind="ghost" size="sm" onClick={() => updateSelectedQueueEntryDate(new Date())}>
          {t('today', 'Today')}
        </Button>
        <Button kind="ghost" size="sm" disabled={!date} onClick={() => updateSelectedQueueEntryDate(null)}>
          {t('clearQueueEntryDate', 'Clear date')}
        </Button>
      </div>
    </div>
  );
}
