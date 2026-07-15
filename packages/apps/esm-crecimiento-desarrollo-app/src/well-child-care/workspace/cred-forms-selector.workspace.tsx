import {
  launchWorkspace2,
  showSnackbar,
  useConfig,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import type { CompletedFormInfo, Form } from '@openmrs/esm-patient-common-lib';
import { FormsSelectorWorkspace } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../config-schema';
import { credCourseLifeEditPrivilege } from '../../constants';
import { resolveCREDForm } from '../../hooks/useCREDFormLauncher';
import { useCREDFormsForAgeGroup } from '../../hooks/useCREDFormsForAgeGroup';
import useEncountersCRED, {
  encounterMatchesFormIdentifier,
  findCREDFormEncounterForControl,
} from '../../hooks/useEncountersCRED';
import { type DefaultPatientWorkspaceProps, formEntryWorkspace } from '../../types';
import { buildCREDFormWorkspaceProps } from '../../utils/cred-form-launch-utils';

interface CREDFormsSelectorWorkspaceProps extends DefaultPatientWorkspaceProps {
  availableForms?: Array<CompletedFormInfo>;
  patientAge?: string;
  patientBirthDate?: string;
  controlNumber?: number;
  consultationDatetime?: string;
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
  const consultationDatetime = props.consultationDatetime ?? workspaceProps.consultationDatetime;
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
  const submittedEncounterUuids = useRef(new Map<string, string>());
  const { patient } = usePatient(patientUuid);
  const { encounters, mutate: mutateCREDEncounters } = useEncountersCRED(patientUuid);
  const fallbackAvailableForms = useCREDFormsForAgeGroup(
    config,
    patientBirthDate ?? patient?.birthDate,
    consultationDatetime,
  );
  const availableForms = providedAvailableForms.length > 0 ? providedAvailableForms : fallbackAvailableForms;
  const filteredAvailableForms = useMemo(
    () =>
      availableForms.filter((formInfo) =>
        userHasAccess(formInfo.requiredPrivilege ?? credCourseLifeEditPrivilege, session?.user),
      ),
    [availableForms, session?.user],
  );
  const formsWithHistory = useMemo(
    () =>
      filteredAvailableForms.map((formInfo) => {
        const associatedEncounters = (encounters ?? [])
          .filter(
            (encounter) => encounter.encounterDatetime && encounterMatchesFormIdentifier(encounter, formInfo.form.uuid),
          )
          .sort(
            (first, second) =>
              new Date(second.encounterDatetime ?? 0).getTime() - new Date(first.encounterDatetime ?? 0).getTime(),
          )
          .map((encounter) => ({
            uuid: encounter.uuid,
            encounterDatetime: encounter.encounterDatetime ?? '',
          }));

        return {
          ...formInfo,
          associatedEncounters,
          lastCompletedDate: associatedEncounters[0]?.encounterDatetime
            ? new Date(associatedEncounters[0].encounterDatetime)
            : undefined,
        };
      }),
    [encounters, filteredAvailableForms],
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
    async (form: Form, _latestEncounterUuid: string, onFormSubmitted: () => void) => {
      try {
        const resolvedForm = await resolveCREDForm(form.uuid, form.display ?? form.name ?? form.uuid);
        const controlFormKey = `${patientUuid}:${controlNumber}:${form.uuid}`;
        const currentControlEncounterUuid =
          submittedEncounterUuids.current.get(controlFormKey) ??
          findCREDFormEncounterForControl(encounters ?? [], form.uuid, controlNumber) ??
          '';
        const handleFormSubmitted = (encounter?: { uuid?: string }) => {
          if (encounter?.uuid) {
            submittedEncounterUuids.current.set(controlFormKey, encounter.uuid);
          }
          void mutateCREDEncounters();
          onFormSubmitted();
        };

        launchWorkspace2(
          formEntryWorkspace,
          buildCREDFormWorkspaceProps(
            resolvedForm,
            currentControlEncounterUuid,
            consultationDatetime,
            handleFormSubmitted,
            {
              controlNumber,
              controlNumberConceptUuid: config.CRED?.controlNumber,
            },
          ),
        );
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
    [config.CRED?.controlNumber, consultationDatetime, controlNumber, encounters, mutateCREDEncounters, patientUuid, t],
  );
  const handleComplete = useCallback(() => {
    void mutateCREDEncounters();
  }, [mutateCREDEncounters]);

  return (
    <RequirePrivilege privilege={credCourseLifeEditPrivilege}>
      <FormsSelectorWorkspace
        availableForms={formsWithHistory}
        patientAge={patientAge}
        controlNumber={controlNumber}
        patientUuid={patientUuid}
        closeWorkspace={closeWorkspace}
        title={title}
        subtitle={subtitle}
        backWorkspace={backWorkspace}
        onFormLaunch={launchForm}
        onComplete={handleComplete}
        promptBeforeClosing={promptBeforeClosing}
        closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
        setTitle={setTitle}
      />
    </RequirePrivilege>
  );
};

export default CREDFormsSelectorWorkspace;
