import { Button } from '@carbon/react';
import { launchWorkspace2, userHasAccess, type Session } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { dispensingEditPrivilege } from '../../constants';
import { initiateMedicationDispenseBody } from '../../medication-dispense/medication-dispense.resource';
import { type MedicationRequestBundle, type Provider } from '../../types';

type DispenseActionButtonProps = {
  patientUuid: string;
  encounterUuid: string;
  medicationRequestBundle: MedicationRequestBundle;
  session: Session;
  providers: Array<Provider>;
  dispensable: boolean;
  quantityRemaining: number;
  quantityDispensed: number;
  disabled: boolean;
};

const DispenseActionButton: React.FC<DispenseActionButtonProps> = ({
  patientUuid,
  encounterUuid,
  medicationRequestBundle,
  session,
  providers,
  dispensable,
  quantityRemaining,
  quantityDispensed,
  disabled,
}) => {
  const { t } = useTranslation();
  const dispenseWorkspaceProps = {
    patientUuid,
    encounterUuid,
    medicationDispense: initiateMedicationDispenseBody(medicationRequestBundle.request, session, providers, true),
    medicationRequestBundle,
    quantityRemaining,
    quantityDispensed,
    mode: 'enter',
  };

  const handleLaunchWorkspace = () => {
    launchWorkspace2('dispense-workspace', dispenseWorkspaceProps);
  };

  if (!dispensable) {
    return null;
  }

  if (!session?.user || !userHasAccess(dispensingEditPrivilege, session.user)) {
    return null;
  }

  return (
    <Button kind="primary" onClick={handleLaunchWorkspace} disabled={disabled}>
      {t('dispense', 'Dispense')}
    </Button>
  );
};

export default DispenseActionButton;
