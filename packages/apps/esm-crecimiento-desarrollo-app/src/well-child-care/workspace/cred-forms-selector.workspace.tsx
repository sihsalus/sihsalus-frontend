import {
  launchWorkspace2,
  showSnackbar,
  useConfig,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { FormsSelectorWorkspace } from '@sihsalus/esm-sihsalus-shared';
import type { CompletedFormInfo, Form } from '@sihsalus/esm-sihsalus-shared/src/ui/forms-selector/types';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../config-schema';
import { credCourseLifeEditPrivilege } from '../../constants';
import { resolveCREDForm } from '../../hooks/useCREDFormLauncher';
import { useCREDFormsForAgeGroup } from '../../hooks/useCREDFormsForAgeGroup';
import { type DefaultPatientWorkspaceProps, formEntryWorkspace } from '../../types';

interface CREDFormsSelectorWorkspaceProps extends DefaultPatientWorkspaceProps {
  availableForms?: Array<CompletedFormInfo>;
  patientAge?: string;
  patientBirthDate?: string;
  controlNumber?: number;
  controlTargetDate?: string;
  title?: string;
  subtitle?: string;
  backWorkspace?: string | null;
}

type CREDCompletedFormInfo = CompletedFormInfo & {
  requiredPrivilege?: string;
};

const CREDFormsSelectorWorkspace: React.FC<CREDFormsSelectorWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const workspaceProps = props.workspaceProps ?? {};
  const providedAvailableForms = (props.availableForms ??
    workspaceProps.availableForms ??
    []) as Array<CREDCompletedFormInfo>;
  const patientAge = props.patientAge ?? workspaceProps.patientAge ?? '';
  const patientBirthDate = props.patientBirthDate ?? workspaceProps.patientBirthDate;
  const controlNumber = props.controlNumber ?? workspaceProps.controlNumber ?? 0;
  const controlTargetDate = props.controlTargetDate ?? workspaceProps.controlTargetDate;
  const title =
    props.title ?? workspaceProps.title ?? t('credFormsSelection', 'Selección de Formularios Crecimiento y Desarrollo');
  const subtitle =
    props.subtitle ??
    workspaceProps.subtitle ??
    t(
      'credFormsInstructions',
      'Seleccione los formularios que desea completar para este control Crecimiento y Desarrollo.',
    );
  const backWorkspace =
    props.backWorkspace !== undefined
      ? props.backWorkspace
      : (workspaceProps.backWorkspace ?? 'wellchild-control-form');
  const patientUuid = props.patientUuid ?? workspaceProps.patientUuid ?? '';
  const { patient } = usePatient(patientUuid);
  const fallbackAvailableForms = useCREDFormsForAgeGroup(
    config,
    patientBirthDate ?? patient?.birthDate,
    controlTargetDate,
  );
  const availableForms = providedAvailableForms.length > 0 ? providedAvailableForms : fallbackAvailableForms;
  const filteredAvailableForms = useMemo(
    () =>
      availableForms.filter((formInfo) =>
        userHasAccess(formInfo.requiredPrivilege ?? credCourseLifeEditPrivilege, session?.user),
      ),
    [availableForms, session?.user],
  );
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

  const launchForm = useCallback(
    async (form: Form, encounterUuid: string) => {
      try {
        const resolvedForm = await resolveCREDForm(form.uuid, form.display ?? form.name ?? form.uuid);

        launchWorkspace2(formEntryWorkspace, {
          form: resolvedForm,
          encounterUuid,
        });
      } catch {
        showSnackbar({
          kind: 'error',
          title: t('credFormNotAvailable', 'Formulario CRED no disponible'),
          subtitle: t(
            'credFormNotAvailableSubtitle',
            'Revise que el formulario esté publicado en OpenMRS y que el UUID o nombre configurado sea correcto.',
          ),
        });
      }
    },
    [t],
  );

  return (
    <RequirePrivilege privilege={credCourseLifeEditPrivilege}>
      <FormsSelectorWorkspace
        availableForms={filteredAvailableForms}
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
    </RequirePrivilege>
  );
};

export default CREDFormsSelectorWorkspace;
