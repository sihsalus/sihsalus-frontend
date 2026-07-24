import { Button, InlineLoading, InlineNotification, Layer, Tag } from '@carbon/react';
import { ArrowLeft, Time } from '@carbon/react/icons';
import {
  ConfigurableLink,
  EmptyCardIllustration,
  getUserFacingErrorMessage,
  isDesktop,
  navigate,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../config-schema';
import { serviceQueuesBasePath } from '../constants';
import { useQueueEntries } from '../hooks/useQueueEntries';
import useQueueStatuses from '../hooks/useQueueStatuses';
import PatientQueueHeader from '../patient-queue-header/patient-queue-header.component';
import QueueDuration from '../queue-table/components/queue-duration.component';
import { StatusSwitcher } from '../queue-table/default-queue-table.component';
import { useServiceQueuesStore } from '../store/store';
import { type Concept, type QueueEntry } from '../types';

import styles from './visual-queue.scss';

export interface QueueBoardColumn {
  status: Concept;
  entries: Array<QueueEntry>;
}

function compareQueueEntries(left: QueueEntry, right: QueueEntry) {
  const sortWeightDifference = (left.sortWeight ?? 0) - (right.sortWeight ?? 0);
  if (sortWeightDifference !== 0) {
    return sortWeightDifference;
  }

  return dayjs(left.startedAt).valueOf() - dayjs(right.startedAt).valueOf();
}

export function buildQueueBoardColumns(
  queueEntries: Array<QueueEntry>,
  configuredStatuses: Array<Concept>,
  selectedStatusUuid?: string | null,
  selectedStatusDisplay?: string | null,
): Array<QueueBoardColumn> {
  const statuses = [...configuredStatuses];

  queueEntries.forEach(({ status }) => {
    if (status?.uuid && !statuses.some(({ uuid }) => uuid === status.uuid)) {
      statuses.push(status);
    }
  });

  if (selectedStatusUuid && !statuses.some(({ uuid }) => uuid === selectedStatusUuid)) {
    statuses.push({ uuid: selectedStatusUuid, display: selectedStatusDisplay ?? '' });
  }

  return statuses
    .filter(({ uuid }) => !selectedStatusUuid || uuid === selectedStatusUuid)
    .map((status) => ({
      status,
      entries: queueEntries
        .filter((entry) => entry.status?.uuid === status.uuid)
        .slice()
        .sort(compareQueueEntries),
    }));
}

function getPriorityTagType(priorityDisplay: string) {
  const normalizedPriority = priorityDisplay.toLocaleLowerCase();

  if (normalizedPriority.includes('no urgente') || normalizedPriority.includes('not urgent')) {
    return 'green';
  }
  if (normalizedPriority.includes('emergencia') || normalizedPriority.includes('emergency')) {
    return 'red';
  }
  if (
    normalizedPriority.includes('urgente') ||
    normalizedPriority.includes('urgent') ||
    normalizedPriority.includes('prioridad') ||
    normalizedPriority.includes('priority')
  ) {
    return 'magenta';
  }

  return 'gray';
}

const VisualQueue = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const {
    selectedQueueLocationUuid,
    selectedQueueStatusDisplay,
    selectedQueueStatusUuid,
    selectedServiceUuid,
  } = useServiceQueuesStore();
  const { statuses, isLoadingQueueStatuses } = useQueueStatuses();
  const searchCriteria = useMemo(
    () => ({
      service: selectedServiceUuid,
      location: selectedQueueLocationUuid,
      status: selectedQueueStatusUuid,
      isEnded: false,
    }),
    [selectedQueueLocationUuid, selectedQueueStatusUuid, selectedServiceUuid],
  );
  const { queueEntries, error, isLoading, isValidating } = useQueueEntries(searchCriteria);
  const columns = useMemo(
    () => buildQueueBoardColumns(queueEntries ?? [], statuses, selectedQueueStatusUuid, selectedQueueStatusDisplay),
    [queueEntries, selectedQueueStatusDisplay, selectedQueueStatusUuid, statuses],
  );

  return (
    <>
      <PatientQueueHeader
        showFilters
        title={t('visualQueue', 'Visual queue')}
        actions={
          <Button
            kind="ghost"
            renderIcon={ArrowLeft}
            size={isDesktop(layout) ? 'sm' : 'md'}
            onClick={() => navigate({ to: serviceQueuesBasePath })}
          >
            {t('backToQueueTable', 'Back to queue table')}
          </Button>
        }
      />
      <main className={styles.page}>
        <StatusSwitcher />
        <Layer className={styles.boardSection}>
          <div className={styles.boardHeader}>
            <div>
              <h2>{t('careFlow', 'Care flow')}</h2>
              <p>
                {t(
                  'visualQueueDescription',
                  'Patients are ordered by queue priority and arrival time within each status.',
                )}
              </p>
            </div>
            <div className={styles.patientTotal}>
              <span>{t('patients', 'Patients')}</span>
              <strong>{queueEntries?.length ?? 0}</strong>
            </div>
          </div>

          {error ? (
            <InlineNotification
              hideCloseButton
              kind="error"
              title={t('errorLoadingQueueEntries', 'Error loading queue entries')}
              subtitle={getUserFacingErrorMessage(
                error,
                t('queueDataLoadErrorMessage', 'Queue information could not be loaded. Please try again.'),
                { logContext: 'Load visual queue' },
              )}
            />
          ) : isLoading || isLoadingQueueStatuses ? (
            <div className={styles.loading}>
              <InlineLoading description={t('loadingVisualQueue', 'Loading visual queue')} />
            </div>
          ) : columns.length === 0 ? (
            <VisualQueueEmptyState />
          ) : (
            <div className={styles.board} role="region" aria-label={t('visualQueue', 'Visual queue')}>
              {columns.map(({ status, entries }) => (
                <section className={styles.lane} key={status.uuid} aria-labelledby={`queue-status-${status.uuid}`}>
                  <header className={styles.laneHeader}>
                    <h3 id={`queue-status-${status.uuid}`}>{status.display || t('unknown', 'Unknown')}</h3>
                    <Tag type={entries.length ? 'blue' : 'gray'}>{entries.length}</Tag>
                  </header>
                  <div className={styles.laneBody}>
                    {entries.length ? (
                      entries.map((queueEntry, index) => (
                        <QueuePatientCard key={queueEntry.uuid} position={index + 1} queueEntry={queueEntry} />
                      ))
                    ) : (
                      <p className={styles.emptyLane}>{t('noPatientsInStatus', 'No patients in this status')}</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}

          {isValidating && !isLoading ? (
            <div className={styles.refreshing}>
              <InlineLoading description={t('updatingQueue', 'Updating queue')} />
            </div>
          ) : null}
        </Layer>
      </main>
    </>
  );
};

function QueuePatientCard({ position, queueEntry }: { position: number; queueEntry: QueueEntry }) {
  const { t } = useTranslation();
  const { customPatientChartUrl } = useConfig<ConfigObject>();
  const patientName = queueEntry.patient?.person?.display ?? queueEntry.patient?.display ?? t('unknown', 'Unknown');
  const priorityDisplay = queueEntry.priority?.display ?? t('unknown', 'Unknown');

  return (
    <article className={styles.patientCard}>
      <div className={styles.cardTopLine}>
        <span className={styles.position} title={t('queuePosition', 'Queue position {{position}}', { position })}>
          {position}
        </span>
        <Tag type={getPriorityTagType(priorityDisplay)}>{priorityDisplay}</Tag>
      </div>
      <ConfigurableLink
        className={styles.patientName}
        to={customPatientChartUrl}
        templateParams={{ patientUuid: queueEntry.patient.uuid }}
      >
        {patientName}
      </ConfigurableLink>
      <p className={styles.queueName}>{queueEntry.queue?.display ?? t('queue', 'Queue')}</p>
      <div className={styles.waitTime}>
        <Time aria-hidden size={16} />
        <span>{t('waitTime', 'Wait time')}:</span>
        <strong>
          <QueueDuration
            startedAt={dayjs(queueEntry.startedAt).toDate()}
            endedAt={queueEntry.endedAt ? dayjs(queueEntry.endedAt).toDate() : undefined}
          />
        </strong>
      </div>
    </article>
  );
}

function VisualQueueEmptyState() {
  const { t } = useTranslation();

  return (
    <div className={styles.emptyBoard}>
      <EmptyCardIllustration />
      <h3>{t('noPatientsToDisplay', 'No patients to display')}</h3>
      <p>{t('checkFilters', 'Check the filters above')}</p>
    </div>
  );
}

export default VisualQueue;
