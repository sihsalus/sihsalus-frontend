import { ActionMenuButton2, EventsIcon, useSession, userHasAccess } from '@openmrs/esm-framework';
import { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

function PatientListsActionButton() {
  const { t } = useTranslation();
  const session = useSession();

  if (!userHasAccess('app:home.listasPacientes.editar', session?.user)) {
    return null;
  }

  return (
    <ActionMenuButton2
      icon={(props: ComponentProps<typeof EventsIcon>) => <EventsIcon {...props} />}
      label={t('patientLists', 'Patient lists')}
      workspaceToLaunch={{
        workspaceName: 'patient-lists',
      }}
    />
  );
}

export default PatientListsActionButton;
