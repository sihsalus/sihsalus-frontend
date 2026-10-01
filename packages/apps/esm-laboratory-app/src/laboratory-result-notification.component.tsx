import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import {
  ExtensionSlot,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  useAssignedExtensions,
  useSession,
  userHasAccess,
  type NotificationDetailState,
} from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import styles from './laboratory-result-notification.scss';

export default function LaboratoryResultNotification({
  notification,
  sessionKey,
  markRead,
  back,
}: NotificationDetailState) {
  const session = useSession();
  const allowed =
    session?.authenticated &&
    userHasAccess(['app:hoja.clinica.ordenes', 'Get Orders', 'Get Patients', 'Get Observations'], session.user);
  const patientUuid = notification.content.patientUuid;
  const valid = allowed && notification.type === 'laboratory-result-ready' && typeof patientUuid === 'string';
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState(false);
  const extensions = useAssignedExtensions('completed-lab-order-results-slot');
  const {
    data: order,
    error,
    isLoading,
    isValidating,
  } = useSWR(
    valid ? [restBaseUrl, notification.subjectUuid, sessionKey] : null,
    async () => {
      const { data } = await openmrsFetch<Order & { voided?: boolean }>(
        `${restBaseUrl}/order/${encodeURIComponent(notification.subjectUuid)}?v=full`,
        { cache: 'no-store' },
      );
      if (
        data.uuid !== notification.subjectUuid ||
        data.patient.uuid !== patientUuid ||
        data.voided ||
        data.fulfillerStatus !== 'COMPLETED'
      )
        throw new Error('Result order unavailable');
      return data;
    },
    { shouldRetryOnError: false },
  );
  const acknowledge = async () => {
    setSaving(true);
    setAcknowledgementError(false);
    try {
      await markRead();
      showSnackbar({
        kind: 'success',
        title: t('notificationMarkedRead', 'Notification marked as read'),
      });
      back();
    } catch {
      setAcknowledgementError(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={styles.content}>
      <Button kind="ghost" size="sm" onClick={back} disabled={saving}>
        {t('backToNotifications', 'Back to notifications')}
      </Button>
      <h2>{notification.content.title}</h2>
      <p>{notification.content.subtitle}</p>
      {isLoading ? <InlineLoading description={t('loadingResults', 'Loading results')} /> : null}
      {!valid || error || extensions.length === 0 ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('resultDetailError', 'The result is unavailable. The notification remains unread.')}
        />
      ) : null}
      {valid && order && !error && !isValidating && extensions.length > 0 ? (
        <ExtensionSlot name="completed-lab-order-results-slot" state={{ order, hideObservations: false }} />
      ) : null}
      {acknowledgementError ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('notificationReadError', 'Could not mark the notification as read. It remains unread.')}
        />
      ) : null}
      <Button
        size="sm"
        onClick={() => void acknowledge()}
        disabled={!valid || saving || !order || isValidating || Boolean(error) || extensions.length === 0}
      >
        {t('markNotificationRead', 'Mark as read')}
      </Button>
      <p>
        {t(
          'readIsNotClinicalReview',
          'Reading this notification does not record clinical review, approval or a signature.',
        )}
      </p>
    </div>
  );
}
