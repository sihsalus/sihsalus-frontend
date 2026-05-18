import { launchWorkspace2 } from '@openmrs/esm-framework';
import { FormsSelectorWorkspace } from '@sihsalus/esm-sihsalus-shared';
import type { CompletedFormInfo, Form } from '@sihsalus/esm-sihsalus-shared/src/ui/forms-selector/types';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type DefaultPatientWorkspaceProps, formEntryWorkspace } from '../../types';

interface CREDFormsSelectorWorkspaceProps extends DefaultPatientWorkspaceProps {
  availableForms?: Array<CompletedFormInfo>;
  patientAge?: string;
  controlNumber?: number;
  title?: string;
  subtitle?: string;
  backWorkspace?: string | null;
}

const CREDFormsSelectorWorkspace: React.FC<CREDFormsSelectorWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const workspaceProps = props.workspaceProps ?? {};
  const availableForms = (props.availableForms ?? workspaceProps.availableForms ?? []) as Array<CompletedFormInfo>;
  const patientAge = (props.patientAge ?? workspaceProps.patientAge ?? '') as string;
  const controlNumber = (props.controlNumber ?? workspaceProps.controlNumber ?? 0) as number;
  const title =
    (props.title ?? workspaceProps.title) ||
    t('credFormsSelection', 'Selección de Formularios Crecimiento y Desarrollo');
  const subtitle =
    (props.subtitle ?? workspaceProps.subtitle) ||
    t(
      'credFormsInstructions',
      'Seleccione los formularios que desea completar para este control Crecimiento y Desarrollo.',
    );
  const backWorkspace =
    props.backWorkspace !== undefined
      ? props.backWorkspace
      : ((workspaceProps.backWorkspace ?? 'wellchild-control-form') as string);
  const patientUuid = (props.patientUuid ?? workspaceProps.patientUuid ?? '') as string;
  const closeWorkspace = (options?: { onWorkspaceClose?: () => void }) => {
    void props.closeWorkspace({ discardUnsavedChanges: true }).then(() => {
      options?.onWorkspaceClose?.();
    });
  };
  const promptBeforeClosing = props.promptBeforeClosing ?? (() => {});
  const closeWorkspaceWithSavedChanges =
    props.closeWorkspaceWithSavedChanges ??
    ((options?: { onWorkspaceClose?: () => void }) => {
      void props.closeWorkspace({ discardUnsavedChanges: false }).then(() => {
        options?.onWorkspaceClose?.();
      });
    });
  const setTitle = props.setTitle ?? (() => {});

  const launchForm = useCallback((form: Form, encounterUuid: string) => {
    launchWorkspace2(formEntryWorkspace, {
      form: { uuid: form.uuid },
      encounterUuid,
    });
  }, []);

  return (
    <FormsSelectorWorkspace
      availableForms={availableForms}
      patientAge={patientAge}
      controlNumber={controlNumber}
      patientUuid={patientUuid}
      closeWorkspace={closeWorkspace}
      title={title}
      subtitle={subtitle}
      backWorkspace={backWorkspace}
      onFormLaunch={launchForm}
      promptBeforeClosing={promptBeforeClosing}
      closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
      setTitle={setTitle}
    />
  );
};

export default CREDFormsSelectorWorkspace;
