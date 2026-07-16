import { Button } from '@carbon/react';
import { launchWorkspace2, type Session, userHasAccess } from '@openmrs/esm-framework';
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
  dispensingLocationUuid: string;
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
  dispensingLocationUuid,
  dispensable,
  quantityRemaining,
  quantityDispensed,
  disabled,
}) => {
  const { t } = useTranslation();
  const handleLaunchWorkspace = () => {
    if (dispensingLocationUuid) {
      launchWorkspace2('dispense-workspace', {
        patientUuid,
        encounterUuid,
        medicationDispense: initiateMedicationDispenseBody(
          medicationRequestBundle.request,
          session,
          providers,
          true,
          dispensingLocationUuid,
        ),
        medicationRequestBundle,
        quantityRemaining,
        quantityDispensed,
        mode: 'enter',
      });
    }
  };

  if (!dispensable) {
    return null;
  }

  if (!session?.user || !userHasAccess(dispensingEditPrivilege, session.user)) {
    return null;
  }

  return (
    <Button kind="primary" onClick={handleLaunchWorkspace} disabled={disabled || !dispensingLocationUuid}>
      {t('dispense', 'Dispense')}
    </Button>
  );
};

export default DispenseActionButton;
