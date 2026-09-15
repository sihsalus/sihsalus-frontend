import { Button, InlineLoading, InlineNotification, Layer, Tag } from '@carbon/react';
import { ArrowLeft, Maximize, Minimize, Renew, Time } from '@carbon/react/icons';
import {
  ConfigurableLink,
  EmptyCardIllustration,
  getUserFacingErrorMessage,
  isDesktop,
  navigate,
  restBaseUrl,
  useConfig,
  useConnectivity,
  useLayoutType,
} from '@openmrs/esm-framework';
import { formatPersonName } from '@openmrs/esm-utils';
import dayjs from 'dayjs';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';

import { type ConfigObject } from '../config-schema';
import { serviceQueuesBasePath } from '../constants';
import { useOperationalQueueEntries } from '../hooks/useOperationalQueueEntries';
import useQueueStatuses from '../hooks/useQueueStatuses';
import PatientQueueHeader from '../patient-queue-header/patient-queue-header.component';
import QueueDuration from '../queue-table/components/queue-duration.component';
import { StatusSwitcher } from '../queue-table/default-queue-table.component';
import { useServiceQueuesStore } from '../store/store';
import { type Concept, type QueueEntry } from '../types';

import { useVisualQueueFullscreen } from './use-visual-queue-fullscreen';
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
  const isOnline = useConnectivity();
  const { mutate: refreshCache } = useSWRConfig();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const layout = useLayoutType();
  const boardId = useId();
  const {
    selectedQueueLocationName,
    selectedQueueLocationUuid,
    selectedQueueStatusDisplay,
    selectedQueueStatusUuid,
    selectedServiceDisplay,
    selectedServiceUuid,
  } = useServiceQueuesStore();
  const { statuses, isLoadingQueueStatuses, queueStatusesError } = useQueueStatuses();
  const {
    boardRef,
    fullscreenButtonRef,
    isFullscreen,
    isFullscreenSupported,
    isFullscreenPending,
    fullscreenError,
    toggleFullscreen,
  } = useVisualQueueFullscreen();
  const searchCriteria = useMemo(
    () => ({
      service: selectedServiceUuid,
      location: selectedQueueLocationUuid,
      status: selectedQueueStatusUuid,
      isEnded: false,
    }),
    [selectedQueueLocationUuid, selectedQueueStatusUuid, selectedServiceUuid],
  );
  const { queueEntries, error, isLoading, isValidating, mutate } = useOperationalQueueEntries(searchCriteria);
  const columns = useMemo(
    () => buildQueueBoardColumns(queueEntries ?? [], statuses, selectedQueueStatusUuid, selectedQueueStatusDisplay),
    [queueEntries, selectedQueueStatusDisplay, selectedQueueStatusUuid, statuses],
  );
  const queueError = error || queueStatusesError;
  const isQueueLoading = Boolean(isLoading || isLoadingQueueStatuses);
  const isDataUnavailable = !isOnline || Boolean(queueError);
  const isAccessDenied = [error, queueStatusesError].some((error) =>
    [401, 403].includes((error as { response?: { status?: number } })?.response?.status ?? 0),
  );
  const showPreviousEntries =
    (isDataUnavailable || isValidating || isRefreshing) && !isAccessDenied && queueEntries.length > 0;

  const refreshQueue = async () => {
    if (!isOnline || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        mutate(),
        refreshCache((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/queue?`)),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <PatientQueueHeader showFilters title={t('visualQueue', 'Visual queue')} />
      <main className={styles.page}>
        <StatusSwitcher />
        <Layer className={styles.boardSection} ref={boardRef} role="region" aria-labelledby={`${boardId}-title`}>
          <div className={styles.boardHeader}>
            <div className={styles.boardHeading}>
              <h2 id={`${boardId}-title`}>{t('careFlow', 'Care flow')}</h2>
              <p>
                {t(
                  'visualQueueDescription',
                  'Patients are ordered by queue priority and arrival time within each status.',
                )}
              </p>
              {isFullscreen ? (
                <p className={styles.filterSummary}>
                  {t('visualQueueScope', 'UPSS: {{location}} · Service: {{service}} · Status: {{status}}', {
                    location: selectedQueueLocationUuid
                      ? (selectedQueueLocationName ?? t('unknown', 'Unknown'))
                      : t('all', 'All'),
                    service: selectedServiceUuid
                      ? (selectedServiceDisplay ?? t('unknown', 'Unknown'))
                      : t('all', 'All'),
                    status: selectedQueueStatusUuid
                      ? (selectedQueueStatusDisplay ?? t('unknown', 'Unknown'))
                      : t('all', 'All'),
                  })}
                </p>
              ) : null}
            </div>
            <div className={styles.boardControls}>
              <div className={styles.patientTotal}>
                <span>{t('patients', 'Patients')}</span>
                <strong>
                  <output
                    aria-label={
                      isDataUnavailable || isQueueLoading
                        ? t('queueCountUnavailable', 'Patient count unavailable')
                        : t('patients', 'Patients')
                    }
                  >
                    {isDataUnavailable || isQueueLoading ? '—' : (queueEntries?.length ?? 0)}
                  </output>
                </strong>
              </div>
              <Button
                kind="ghost"
                renderIcon={Renew}
                size={isDesktop(layout) ? 'sm' : 'md'}
                disabled={!isOnline || isQueueLoading || isValidating || isRefreshing}
                onClick={refreshQueue}
              >
                {t('refreshVisualQueue', 'Refresh queue')}
              </Button>
              <Button
                kind="tertiary"
                renderIcon={isFullscreen ? Minimize : Maximize}
                size={isDesktop(layout) ? 'sm' : 'md'}
                ref={fullscreenButtonRef}
                disabled={!isFullscreenSupported}
                aria-disabled={isFullscreenPending || !isFullscreenSupported}
                aria-pressed={isFullscreen}
                aria-describedby={!isFullscreenSupported ? `${boardId}-fullscreen-unavailable` : undefined}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? t('exitQueueFullscreen', 'Exit fullscreen') : t('enterQueueFullscreen', 'Fullscreen')}
              </Button>
              {isOnline && (isValidating || isRefreshing) && !isQueueLoading ? (
                <div className={styles.refreshing}>
                  <InlineLoading description={t('updatingQueue', 'Updating queue')} />
                </div>
              ) : null}
            </div>
          </div>

          {!isFullscreenSupported ? (
            <p className={styles.fullscreenHint} id={`${boardId}-fullscreen-unavailable`}>
              {t('queueFullscreenUnavailable', 'Fullscreen is not available in this browser.')}
            </p>
          ) : null}
          {fullscreenError ? (
            <InlineNotification
              className={styles.notification}
              hideCloseButton
              kind="error"
              title={t('queueFullscreenError', 'Could not change fullscreen mode')}
              subtitle={t('queueFullscreenErrorMessage', 'Try again or use Esc to exit fullscreen.')}
            />
          ) : null}

          {!isOnline ? (
            <InlineNotification
              className={styles.notification}
              hideCloseButton
              kind="warning"
              title={t('visualQueueOffline', 'No connection')}
              subtitle={t('visualQueueOfflineMessage', 'Queue changes cannot be checked until the connection returns.')}
            />
          ) : queueError ? (
            <InlineNotification
              className={styles.notification}
              hideCloseButton
              kind="error"
              title={
                error
                  ? t('errorLoadingQueueEntries', 'Error loading queue entries')
                  : t('errorLoadingQueueStatuses', 'Error loading queue statuses')
              }
              subtitle={getUserFacingErrorMessage(
                queueError,
                t('queueDataLoadErrorMessage', 'Queue information could not be loaded. Please try again.'),
                { logContext: 'Load visual queue' },
              )}
            />
          ) : null}
          {showPreviousEntries ? (
            <p className={styles.fullscreenHint} role="status">
              {t(
                'visualQueuePreviousData',
                'Showing the last complete queue loaded in this view. It may have changed.',
              )}
            </p>
          ) : null}

          {isDataUnavailable && !showPreviousEntries ? null : isQueueLoading && !showPreviousEntries ? (
            <div className={styles.loading}>
              <InlineLoading description={t('loadingVisualQueue', 'Loading visual queue')} />
            </div>
          ) : columns.length === 0 ? (
            <VisualQueueEmptyState />
          ) : (
            <div className={styles.board} role="region" aria-label={t('visualQueue', 'Visual queue')}>
              {columns.map(({ status, entries }) => (
                <section className={styles.lane} key={status.uuid}>
                  <header className={styles.laneHeader}>
                    <h3 id={`${boardId}-${status.uuid}`}>{status.display || t('unknown', 'Unknown')}</h3>
                    <Tag type={entries.length ? 'blue' : 'gray'}>{isDataUnavailable ? '—' : entries.length}</Tag>
                  </header>
                  <div className={styles.laneBody} role="region" aria-labelledby={`${boardId}-${status.uuid}`}>
                    {entries.length ? (
                      entries.map((queueEntry, index) => (
                        <QueuePatientCard key={queueEntry.uuid} position={index + 1} queueEntry={queueEntry} />
                      ))
                    ) : (
                      <p className={styles.emptyLane}>
                        {isDataUnavailable
                          ? t('visualQueueUnconfirmedStatus', 'Current queue information is unavailable')
                          : t('noPatientsInStatus', 'No patients in this status')}
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Layer>
        <div className={styles.pageFooter}>
          <Button
            kind="ghost"
            renderIcon={ArrowLeft}
            size={isDesktop(layout) ? 'sm' : 'md'}
            onClick={() => navigate({ to: serviceQueuesBasePath })}
          >
            {t('backToQueueTable', 'Back to queue table')}
          </Button>
        </div>
      </main>
    </>
  );
};

function QueuePatientCard({ position, queueEntry }: { position: number; queueEntry: QueueEntry }) {
  const { t } = useTranslation();
  const { customPatientChartUrl } = useConfig<ConfigObject>();
  const patientName = formatPersonName(
    queueEntry.patient?.person?.display ?? queueEntry.patient?.display ?? t('unknown', 'Unknown'),
  );
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
