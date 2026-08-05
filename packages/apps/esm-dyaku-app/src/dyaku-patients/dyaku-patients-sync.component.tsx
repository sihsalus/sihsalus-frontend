import { Button, InlineLoading, InlineNotification, Modal, ProgressBar } from '@carbon/react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type SyncResult, useDyakuSync } from './dyaku-patients.resource';
import styles from './dyaku-patients-sync.scss';

interface DyakuPatientsSyncProps {
  onSyncComplete?: (result: SyncResult) => void;
}

const DyakuPatientsSync: React.FC<DyakuPatientsSyncProps> = ({ onSyncComplete }) => {
  const { t } = useTranslation();
  const { syncPatients, isEnabled, batchSize } = useDyakuSync();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const closeModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeModalTimerRef.current !== null) {
        clearTimeout(closeModalTimerRef.current);
      }
    };
  }, []);

  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

  const handleStartSync = () => {
    if (!isEnabled) return;

    setIsSyncing(true);
    setProcessed(0);
    setTotal(0);
    setSyncResult(null);

    void (async () => {
      try {
        const result = await syncPatients((done, outOf) => {
          setProcessed(done);
          setTotal(outOf);
        });

        setSyncResult(result);
        onSyncComplete?.(result);

        if (result.success) {
          if (closeModalTimerRef.current !== null) {
            clearTimeout(closeModalTimerRef.current);
          }
          closeModalTimerRef.current = setTimeout(() => {
            setIsModalOpen(false);
            setIsSyncing(false);
            setProcessed(0);
            setTotal(0);
          }, 2000);
        }
      } catch (error) {
        setSyncResult({
          success: false,
          synchronized: 0,
          failed: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } finally {
        setIsSyncing(false);
      }
    })();
  };

  const handleCloseModal = () => {
    if (!isSyncing) {
      setIsModalOpen(false);
      setSyncResult(null);
      setProcessed(0);
      setTotal(0);
    }
  };

  return (
    <>
      <Button kind="secondary" onClick={() => setIsModalOpen(true)} disabled={!isEnabled} size="md">
        {t('syncDyakuPatients', 'Sincronizar Pacientes')}
      </Button>

      <Modal
        open={isModalOpen}
        onRequestClose={handleCloseModal}
        modalHeading={t('syncDyakuPatientsTitle', 'Sincronización de Pacientes Dyaku')}
        primaryButtonText={isSyncing ? t('syncing', 'Sincronizando...') : t('startSync', 'Iniciar Sincronización')}
        secondaryButtonText={t('cancel', 'Cancelar')}
        onRequestSubmit={handleStartSync}
        onSecondarySubmit={handleCloseModal}
        primaryButtonDisabled={isSyncing || !isEnabled}
        size="md"
      >
        <div className={styles.syncContent}>
          {!isEnabled && (
            <InlineNotification
              kind="warning"
              title={t('syncDisabled', 'Sincronización deshabilitada')}
              subtitle={t('syncDisabledMessage', 'La sincronización está deshabilitada en la configuración.')}
              hideCloseButton
              lowContrast
            />
          )}

          {isEnabled && !isSyncing && !syncResult && (
            <div className={styles.syncDescription}>
              <p>
                {t(
                  'syncDescription',
                  'Este proceso sincronizará hasta {{batchSize}} pacientes desde el sistema FHIR Dyaku hacia OpenMRS.',
                  { batchSize },
                )}
              </p>
              <p>
                {t(
                  'syncWarning',
                  'Los pacientes existentes serán actualizados, y los nuevos serán creados automáticamente.',
                )}
              </p>
            </div>
          )}

          {isSyncing && (
            <div className={styles.syncProgress}>
              <InlineLoading description={t('syncingPatients', 'Sincronizando pacientes...')} />
              <ProgressBar
                value={progress}
                max={100}
                label={t('syncProgressLabel', 'Progreso de sincronización')}
                className={styles.progressBar}
              />
              <p className={styles.progressText}>
                {total > 0
                  ? t('syncProgressOf', '{{processed}} / {{total}} pacientes procesados', { processed, total })
                  : t('syncInitializing', 'Iniciando sincronización...')}
              </p>
            </div>
          )}

          {syncResult && (
            <div className={styles.syncResults}>
              <InlineNotification
                kind={syncResult.success ? 'success' : 'error'}
                title={
                  syncResult.success
                    ? t('syncSuccess', 'Sincronización completada')
                    : t('syncError', 'Error en la sincronización')
                }
                subtitle={
                  syncResult.success
                    ? t('syncSuccessMessage', 'Se sincronizaron {{count}} pacientes exitosamente.', {
                        count: syncResult.synchronized,
                      })
                    : t('syncErrorMessage', 'Error durante la sincronización. Ver detalles abajo.')
                }
                hideCloseButton
                lowContrast
              />

              {syncResult.synchronized > 0 && (
                <div className={styles.syncStats}>
                  <p>
                    {t('synchronized', 'Sincronizados')}: {syncResult.synchronized}
                  </p>
                  {syncResult.failed > 0 && (
                    <p>
                      {t('failed', 'Fallidos')}: {syncResult.failed}
                    </p>
                  )}
                </div>
              )}

              {syncResult.errors.length > 0 && (
                <div className={styles.syncErrors}>
                  <h4>{t('syncErrors', 'Errores:')}</h4>
                  <ul>
                    {syncResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default DyakuPatientsSync;
