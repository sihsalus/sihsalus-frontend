import { Button, HeaderGlobalAction, InlineLoading, InlineNotification, Tile } from '@carbon/react';
import { Notification } from '@carbon/icons-react';
import { ExtensionSlot, openmrsFetch, restBaseUrl, showSnackbar, useAssignedExtensions } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { type PendingResult, type useDoctorResults } from '../../doctor-results.resource';
import styles from './doctor-results.scss';

type Inbox = ReturnType<typeof useDoctorResults>;
export function DoctorResultsButton({
  inbox,
  expanded,
  toggle,
}: {
  inbox: Inbox;
  expanded: boolean;
  toggle: () => void;
}) {
  const { t } = useTranslation();
  if (!inbox.allowed) return null;
  const total = inbox.data?.total;
  return (
    <HeaderGlobalAction
      isActive={expanded}
      onClick={toggle}
      aria-label={
        total === undefined
          ? t('resultNotifications', 'Laboratory results')
          : t('pendingResultCount', '{{count}} results pending review', {
              count: total,
            })
      }
    >
      <Notification size={20} />
      {total ? <span className={styles.count}>{total > 99 ? '99+' : total}</span> : null}
    </HeaderGlobalAction>
  );
}

export function DoctorResultsPanel({
  inbox,
  offset,
  setOffset,
}: {
  inbox: Inbox;
  offset: number;
  setOffset: (offset: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<PendingResult>();
  if (!inbox.allowed) return null;
  if (selected) return <ResultDetail result={selected} inbox={inbox} back={() => setSelected(undefined)} />;
  return (
    <div className={styles.content}>
      <p>{t('pendingResultExplanation', 'Results of your laboratory orders pending review.')}</p>
      <Button
        kind="ghost"
        size="sm"
        onClick={() => void inbox.mutate().catch(() => undefined)}
        disabled={inbox.isValidating}
      >
        {t('refreshResults', 'Refresh')}
      </Button>
      {inbox.error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('resultInboxError', 'Could not load pending results. Retry to confirm the current list.')}
        />
      ) : null}
      {inbox.isLoading ? <InlineLoading description={t('loadingResults', 'Loading results')} /> : null}
      {!inbox.error && inbox.data?.total === 0 ? (
        <Tile>{t('noPendingResults', 'No results pending review')}</Tile>
      ) : null}
      <ul className={styles.list}>
        {inbox.data?.results.map((result) => (
          <li key={result.id} className={styles.item}>
            <strong>{result.patientName}</strong>
            <p>{result.testName}</p>
            <time dateTime={result.createdAt}>
              {new Date(result.createdAt).toLocaleString(i18n.resolvedLanguage || i18n.language, {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </time>
            <Button kind="ghost" size="sm" onClick={() => setSelected(result)} disabled={Boolean(inbox.error)}>
              {t('viewResult', 'View result')}
            </Button>
          </li>
        ))}
      </ul>
      {offset > 0 || inbox.data?.hasMore ? (
        <div className={styles.actions}>
          <Button
            kind="ghost"
            size="sm"
            disabled={offset === 0 || inbox.isValidating}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            {t('previousResults', 'Previous')}
          </Button>
          <Button
            kind="ghost"
            size="sm"
            disabled={!inbox.data?.hasMore || inbox.isValidating}
            onClick={() => setOffset(offset + 20)}
          >
            {t('nextResults', 'Next')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ResultDetail({ result, inbox, back }: { result: PendingResult; inbox: Inbox; back: () => void }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState(false);
  const extensions = useAssignedExtensions('completed-lab-order-results-slot');
  const {
    data: order,
    error,
    isLoading,
    isValidating,
  } = useSWR(
    [restBaseUrl, result.orderUuid, inbox.sessionKey],
    async () => {
      const { data } = await openmrsFetch<Order & { voided?: boolean }>(
        `${restBaseUrl}/order/${result.orderUuid}?v=full`,
        { cache: 'no-store' },
      );
      if (
        data.uuid !== result.orderUuid ||
        data.patient.uuid !== result.patientUuid ||
        data.voided ||
        data.fulfillerStatus !== 'COMPLETED'
      )
        throw new Error('Result order unavailable');
      return data;
    },
    { shouldRetryOnError: false },
  );
  const review = async () => {
    setSaving(true);
    setReviewError(false);
    try {
      await inbox.review(result.id);
      showSnackbar({
        kind: 'success',
        title: t('resultMarkedReviewed', 'Result marked as reviewed'),
      });
      back();
    } catch {
      setReviewError(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={styles.content}>
      <Button kind="ghost" size="sm" onClick={back} disabled={saving}>
        {t('backToPendingResults', 'Back to pending results')}
      </Button>
      <h2>{result.patientName}</h2>
      <p>{result.testName}</p>
      {isLoading ? <InlineLoading description={t('loadingResults', 'Loading results')} /> : null}
      {error || extensions.length === 0 ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('resultDetailError', 'The result is unavailable. It remains pending review.')}
        />
      ) : null}
      {order && !error && !isValidating && extensions.length > 0 ? (
        <ExtensionSlot name="completed-lab-order-results-slot" state={{ order, hideObservations: false }} />
      ) : null}
      {reviewError ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('resultReviewError', 'Could not mark the result as reviewed. It remains pending.')}
        />
      ) : null}
      <Button
        size="sm"
        onClick={() => void review()}
        disabled={saving || !order || isValidating || Boolean(error) || extensions.length === 0}
      >
        {t('markResultReviewed', 'Mark as reviewed')}
      </Button>
      <p>
        {t(
          'reviewIsNotApproval',
          'This marks your notification as reviewed; it does not approve or change the laboratory result.',
        )}
      </p>
    </div>
  );
}
