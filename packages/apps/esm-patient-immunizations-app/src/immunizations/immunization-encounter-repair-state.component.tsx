import { ActionableNotification, InlineLoading } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import { CardHeader } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './immunization-encounter-repair-state.scss';

interface ImmunizationEncounterRepairStateProps {
  headerTitle: string;
  /** Adds the missing provider role and reloads; omitted when the user has no provider record. */
  onRepair: (() => Promise<void>) | null;
}

/**
 * Error state shown when FHIR2 cannot read the vaccination history because a
 * vaccination encounter has no provider with the "Unknown" encounter role.
 */
const ImmunizationEncounterRepairState: React.FC<ImmunizationEncounterRepairStateProps> = ({
  headerTitle,
  onRepair,
}) => {
  const { t } = useTranslation();
  const [isRepairing, setIsRepairing] = useState(false);

  const handleRepair = useCallback(async () => {
    if (!onRepair) {
      return;
    }
    setIsRepairing(true);
    try {
      await onRepair();
    } catch {
      showSnackbar({
        kind: 'error',
        isLowContrast: false,
        title: t('encounterRepairFailed', 'The vaccination record could not be repaired'),
        subtitle: t('encounterRepairFailedHint', 'Try again or contact support.'),
      });
    } finally {
      setIsRepairing(false);
    }
  }, [onRepair, t]);

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <span>{isRepairing ? <InlineLoading description={t('repairing', 'Repairing') + '...'} /> : null}</span>
      </CardHeader>
      <ActionableNotification
        actionButtonLabel={onRepair && !isRepairing ? t('repair', 'Repair') : undefined}
        className={styles.notification}
        hideCloseButton
        inline
        kind="error"
        lowContrast
        onActionButtonClick={handleRepair}
        role="status"
        subtitle={
          onRepair
            ? t(
                'encounterProviderMissingRepairHint',
                'Repair adds your provider record to that encounter with the required role and reloads the history.',
              )
            : t(
                'encounterProviderMissingNoProviderHint',
                'Your user account has no provider record. Ask support to repair the encounter.',
              )
        }
        title={t(
          'encounterProviderMissing',
          'A vaccination encounter lacks the provider role required to read the vaccination history.',
        )}
      />
    </div>
  );
};

export default ImmunizationEncounterRepairState;
