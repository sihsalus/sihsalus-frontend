import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { CheckmarkOutline, CloudUpload } from '@carbon/react/icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './dyaku-patient-sync-button.scss';
import { type DyakuPatient, type SyncResult, useDyakuSync } from './dyaku-patients.resource';

interface DyakuPatientSyncButtonProps {
  patient: DyakuPatient;
  onSyncComplete?: (result: SyncResult) => void;
  size?: 'sm' | 'md' | 'lg';
}

const DyakuPatientSyncButton: React.FC<DyakuPatientSyncButtonProps> = ({ patient, onSyncComplete, size = 'sm' }) => {
  const { t } = useTranslation();
  const { syncSinglePatient, isEnabled } = useDyakuSync();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const hideResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideResultTimerRef.current !== null) {
        clearTimeout(hideResultTimerRef.current);
      }
    };
  }, []);

  const scheduleHideResult = (delayMs: number) => {
    if (hideResultTimerRef.current !== null) {
      clearTimeout(hideResultTimerRef.current);
    }
    hideResultTimerRef.current = setTimeout(() => {
      setShowResult(false);
      setSyncResult(null);
    }, delayMs);
  };

  const handleSync = () => {
    if (!isEnabled || isSyncing) return;

    setIsSyncing(true);
    setSyncResult(null);
    setShowResult(false);

    void (async () => {
      try {
        const result = await syncSinglePatient(patient);
        setSyncResult(result);
        setShowResult(true);

        if (onSyncComplete) {
          onSyncComplete(result);
        }

        // Auto-hide result after 3 seconds
        scheduleHideResult(3000);
      } catch (error) {
        setSyncResult({
          success: false,
          synchronized: 0,
          failed: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
        setShowResult(true);

        scheduleHideResult(5000);
      } finally {
        setIsSyncing(false);
      }
    })();
  };

  if (isSyncing) {
    return (
      <div className={styles.syncingContainer}>
        <InlineLoading description={t('syncingPatient', 'Sincronizando...')} />
      </div>
    );
  }

  if (showResult && syncResult) {
    return (
      <div className={styles.resultContainer}>
        <InlineNotification
          kind={syncResult.success ? 'success' : 'error'}
          title={syncResult.success ? t('syncSuccess', 'Éxito') : t('syncError', 'Error')}
          subtitle={
            syncResult.success
              ? t('patientSyncedSuccessfully', 'Paciente sincronizado')
              : syncResult.errors[0] || t('syncErrorOccurred', 'Error en sincronización')
          }
          hideCloseButton
          lowContrast
          className={styles.notification}
        />
      </div>
    );
  }

  return (
    <Button
      kind="ghost"
      size={size}
      renderIcon={syncResult?.success ? CheckmarkOutline : CloudUpload}
      onClick={handleSync}
      disabled={!isEnabled}
      className={`${styles.syncButton} ${syncResult?.success ? styles.synced : ''}`}
      hasIconOnly
      iconDescription={
        syncResult?.success
          ? t('patientAlreadySynced', 'Paciente sincronizado')
          : t('syncPatient', 'Sincronizar paciente')
      }
    />
  );
};

export default DyakuPatientSyncButton;
