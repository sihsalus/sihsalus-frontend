import { ActionableNotification, InlineNotification } from '@carbon/react';
import { navigate, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useSisFinancingStatus } from '../hooks/useSisFinancingStatus';
import styles from './sis-financing-warning.scss';

const billingPrivilege = 'app:home.facturacion';

interface SisFinancingWarningProps {
  patientUuid: string;
}

/**
 * Advertencia no bloqueante: la visita activa no tiene financiador definido o
 * el SIS no está vigente. Reutiliza la semántica del gating de triaje y el
 * patrón "Derivar a Caja"; el bloqueo duro permanece en el flujo de FUA.
 */
const SisFinancingWarning: React.FC<SisFinancingWarningProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { showSisFinancingWarning } = useConfig<ConfigObject>();
  const session = useSession();
  const { requiresRegularization, isLoading } = useSisFinancingStatus(patientUuid);

  if (!showSisFinancingWarning || isLoading || !requiresRegularization) {
    return null;
  }

  const title = t('sisFinancingWarningTitle', 'Cobertura SIS por regularizar');
  const subtitle = t(
    'sisFinancingWarningSubtitle',
    'Esta atención no tiene financiador definido o el SIS no está vigente. Derive al paciente a Caja o Admisión para regularizar la cobertura; el FUA requiere la acreditación SIS completa.',
  );
  const canOpenBilling = userHasAccess(billingPrivilege, session?.user);

  if (!canOpenBilling) {
    return (
      <InlineNotification
        className={styles.warning}
        hideCloseButton
        kind="warning"
        lowContrast
        subtitle={subtitle}
        title={title}
      />
    );
  }

  return (
    <ActionableNotification
      actionButtonLabel={t('goToBilling', 'Ir a Caja')}
      className={styles.warning}
      hideCloseButton
      inline
      kind="warning"
      lowContrast
      onActionButtonClick={() => navigate({ to: `${globalThis.getOpenmrsSpaBase()}home/billing` })}
      subtitle={subtitle}
      title={title}
    />
  );
};

export default SisFinancingWarning;
