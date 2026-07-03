import { Button } from '@carbon/react';
import { launchWorkspace2, userHasAccess, type Session } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { dispensingEditPrivilege } from '../../constants';
import { initiateMedicationDispenseBody } from '../../medication-dispense/medication-dispense.resource';
import { type MedicationRequestBundle, type Provider } from '../../types';

type PauseActionButtonProps = {
  patientUuid: string;
  encounterUuid: string;
  medicationRequestBundle: MedicationRequestBundle;
  session: Session;
  providers: Array<Provider>;
  pauseable: boolean;
  disabled: boolean;
};

const PauseActionButton: React.FC<PauseActionButtonProps> = ({
  patientUuid,
  encounterUuid,
  medicationRequestBundle,
  session,
  providers,
  pauseable,
  disabled,
}) => {
  const { t } = useTranslation();
  const pauseWorkspaceProps = {
    patientUuid,
    encounterUuid,
    medicationDispense: initiateMedicationDispenseBody(medicationRequestBundle.request, session, providers, false),
    mode: 'enter',
  };

  const handleLaunchWorkspace = () => {
    launchWorkspace2('pause-dispense-workspace', pauseWorkspaceProps);
  };

  if (!pauseable) {
    return null;
  }
  if (!session?.user || !userHasAccess(dispensingEditPrivilege, session.user)) {
    return null;
  }
  return (
    <Button kind="secondary" onClick={handleLaunchWorkspace} disabled={disabled}>
      {t('pause', 'Pause')}
    </Button>
  );
};

export default PauseActionButton;
