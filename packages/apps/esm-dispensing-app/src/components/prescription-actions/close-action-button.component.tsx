import { Button } from '@carbon/react';
import { launchWorkspace2, userHasAccess, type Session } from '@openmrs/esm-framework';
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
  closeable: boolean;
  disabled: boolean;
};

const CloseActionButton: React.FC<CloseActionButtonProps> = ({
  patientUuid,
  encounterUuid,
  medicationRequestBundle,
  session,
  providers,
  closeable,
  disabled,
}) => {
  const { t } = useTranslation();

  const closeDispenseFormProps = {
    patientUuid,
    encounterUuid,
    medicationDispense: initiateMedicationDispenseBody(medicationRequestBundle.request, session, providers, false),
    mode: 'enter',
  };

  const handleLaunchWorkspace = () => {
    launchWorkspace2('close-dispense-workspace', closeDispenseFormProps);
  };

  if (!closeable) {
    return null;
  }
  if (!session?.user || !userHasAccess(dispensingEditPrivilege, session.user)) {
    return null;
  }
  return (
    <Button kind="danger" onClick={handleLaunchWorkspace} disabled={disabled}>
      {t('close', 'Close')}
    </Button>
  );
};

export default CloseActionButton;
