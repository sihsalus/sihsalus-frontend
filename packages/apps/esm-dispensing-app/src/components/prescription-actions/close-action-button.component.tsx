import { Button } from '@carbon/react';
import { launchWorkspace2, type Session, userHasAccess } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { dispensingEditPrivilege } from '../../constants';
import { initiateMedicationDispenseBody } from '../../medication-dispense/medication-dispense.resource';
import { type MedicationRequestBundle, type Provider } from '../../types';

type CloseActionButtonProps = {
  patientUuid: string;
  encounterUuid: string;
  medicationRequestBundle: MedicationRequestBundle;
  session: Session;
  providers: Array<Provider>;
  dispensingLocationUuid: string;
  closeable: boolean;
  disabled: boolean;
};

const CloseActionButton: React.FC<CloseActionButtonProps> = ({
  patientUuid,
  encounterUuid,
  medicationRequestBundle,
  session,
  providers,
  dispensingLocationUuid,
  closeable,
  disabled,
}) => {
  const { t } = useTranslation();

  const handleLaunchWorkspace = () => {
    if (dispensingLocationUuid) {
      launchWorkspace2('close-dispense-workspace', {
        patientUuid,
        encounterUuid,
        medicationDispense: initiateMedicationDispenseBody(
          medicationRequestBundle.request,
          session,
          providers,
          false,
          dispensingLocationUuid,
        ),
        mode: 'enter',
      });
    }
  };

  if (!closeable) {
    return null;
  }
  if (!session?.user || !userHasAccess(dispensingEditPrivilege, session.user)) {
    return null;
  }
  return (
    <Button kind="danger" onClick={handleLaunchWorkspace} disabled={disabled || !dispensingLocationUuid}>
      {t('close', 'Close')}
    </Button>
  );
};

export default CloseActionButton;
