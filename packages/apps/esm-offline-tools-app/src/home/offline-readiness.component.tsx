import { Button, InlineNotification, Tile } from '@carbon/react';
import { clearOfflineDownloads, getOfflineReadiness, showModal } from '@openmrs/esm-framework';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import type { ConfirmationModalProps } from '../components/confirmation.modal';
import { useOfflineOwnerId } from '../hooks/use-offline-owner';

export default function OfflineReadiness() {
  const { t } = useTranslation();
  const owner = useOfflineOwnerId();
  const { data, error, isValidating, mutate } = useSWR(
    owner ? ['offline-readiness', owner] : null,
    getOfflineReadiness,
    {
      shouldRetryOnError: false,
      revalidateOnFocus: true,
    },
  );
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const execute = async (operation: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await operation();
      await mutate();
    } catch {
      setFailed(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const confirmClear = () => {
    const closeModal = showModal('offline-tools-confirmation-modal', {
      title: t('clearOfflineDownloads', 'Clear downloaded copies'),
      confirmText: t('clearOfflineDownloads', 'Clear downloaded copies'),
      cancelText: t('cancel', 'Cancel'),
      children: t(
        'clearOfflineDownloadsConfirmation',
        'Download the selected patients and forms again afterwards. Pending actions must be synchronized or reconciled first; they are never deleted by this operation.',
      ),
      closeModal: () => closeModal(),
      onConfirm: () => void execute(clearOfflineDownloads),
    } satisfies ConfirmationModalProps);
  };
  return (
    <Tile aria-label={t('offlinePreparation', 'Offline preparation')}>
      <h3>{t('offlinePreparation', 'Offline preparation')}</h3>
      <p>
        {data?.ready
          ? t('offlineDownloadsVerified', 'Selected downloads verified')
          : t('offlinePreparationIncomplete', 'Preparation is incomplete or has not been verified')}
      </p>
      <p>
        {t(
          'offlinePreparationScope',
          'This checks selected downloads. Test the clinical workflows on this device before using it without a connection.',
        )}
      </p>
      {data && (
        <>
          <p>
            {t('offlinePreparedCounts', 'Patients: {{patients}} · Forms: {{forms}} · Incomplete: {{incomplete}}', {
              patients: data.patients,
              forms: data.forms,
              incomplete: data.incomplete,
            })}
          </p>
          <p>
            {t('offlineOldestDownload', 'Oldest verified download: {{date}}', {
              date: data.oldestDownload?.toLocaleString() ?? '—',
            })}
          </p>
          <p>
            {data.storage === 'available'
              ? t('offlineStorageAvailable', 'Storage reserve available')
              : t('offlineStorageUnverified', 'Storage reserve is insufficient or could not be checked')}
          </p>
          <p>
            {data.persistent
              ? t('offlinePersistent', 'Persistent storage granted')
              : t('offlineNotPersistent', 'Persistent storage has not been granted')}
          </p>
          {data.profile !== 'ready' && (
            <p>
              {t(
                'offlineProfileUnavailable',
                'Downloads are blocked. Connect with the user assigned to this browser profile. Older downloads may require cleanup.',
              )}
            </p>
          )}
        </>
      )}
      {(error || failed) && (
        <InlineNotification
          kind="error"
          role="alert"
          hideCloseButton
          title={t('offlinePreparationFailed', 'The operation could not be completed')}
          subtitle={t('offlinePreparationRetry', 'Check your connection and pending actions, then try again.')}
        />
      )}
      <Button
        kind="tertiary"
        size="sm"
        disabled={busy || isValidating || !owner}
        onClick={() => void execute(async () => {})}
      >
        {t('checkOfflinePreparation', 'Check preparation')}
      </Button>
      <Button
        kind="tertiary"
        size="sm"
        disabled={busy || !owner || !navigator.storage?.persist || data?.persistent}
        onClick={() =>
          void execute(async () => {
            await navigator.storage.persist();
          })
        }
      >
        {t('requestPersistentStorage', 'Request persistent storage')}
      </Button>
      <Button kind="danger--tertiary" size="sm" disabled={busy || !owner || !navigator.onLine} onClick={confirmClear}>
        {t('clearOfflineDownloads', 'Clear downloaded copies')}
      </Button>
    </Tile>
  );
}
