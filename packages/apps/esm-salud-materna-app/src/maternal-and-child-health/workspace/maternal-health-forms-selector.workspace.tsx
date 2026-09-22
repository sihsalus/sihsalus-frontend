import {
  getSessionStore,
  launchWorkspace2,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  type Session,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import type { CompletedFormInfo, Form } from '@openmrs/esm-patient-common-lib';
import { FormsSelectorWorkspace } from '@openmrs/esm-patient-common-lib';
import { UnauthorizedState } from '@sihsalus/esm-rbac';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import type { ConfigObject } from '../../config-schema';
import {
  cancerPreventionEditPrivilege,
  familyPlanningEditPrivilege,
  labourDeliveryEditPrivilege,
  maternalHealthPrivileges,
  maternalPatientChartPrivilege,
  postnatalCareEditPrivilege,
  prenatalCareEditPrivilege,
} from '../../constants';
import { useCurrentPregnancy } from '../../hooks/useCurrentPregnancy';
import { resolveMaternalForm } from '../../hooks/useMaternalFormLauncher';
import { type DefaultPatientWorkspaceProps, formEntryWorkspace } from '../../types';
import {
  encounterMatchesForm,
  isWithinPregnancyEpisode,
  type MaternalEncounter,
} from '../../utils/pregnancy-episode-utils';

interface EncounterResponse {
  results: MaternalEncounter[];
}

const maternalFormKeys = [
  'maternalHistory',
  'currentPregnancy',
  'atencionPrenatal',
  'prenatalSupplementationForm',
  'screeningIndicatorsForm',
  'psychoprophylaxisForm',
  'birthPlanForm',
  'deliveryOrAbortion',
  'SummaryOfLaborAndPostpartum',
  'obstetricMonitor',
  'immediatePostpartumPeriod',
  'postpartumControl',
  'maternalDischargeForm',
  'maternalReadmissionForm',
  'obstetricsServiceForm',
  'adolescentPregnancyCareForm',
  'obstetricReferralForm',
  'culturalBirthPreferencesForm',
  'perinatalMentalHealthForm',
  'maternalViolenceScreeningForm',
  'familyPlanningCounselingForm',
  'familyPlanningFollowupForm',
  'cervicalCancerScreeningForm',
  'breastCancerScreeningForm',
] as const satisfies ReadonlyArray<keyof ConfigObject['formsList']>;

type MaternalFormKey = (typeof maternalFormKeys)[number];

const formLabels: Partial<Record<keyof ConfigObject['formsList'], string>> = {
  maternalHistory: 'Antecedentes obstétricos',
  currentPregnancy: 'Embarazo actual',
  atencionPrenatal: 'Atención prenatal',
  prenatalSupplementationForm: 'Suplementación gestante',
  screeningIndicatorsForm: 'Tamizaje prenatal',
  psychoprophylaxisForm: 'Psicoprofilaxis obstétrica',
  birthPlanForm: 'Plan de parto',
  deliveryOrAbortion: 'Parto o aborto',
  SummaryOfLaborAndPostpartum: 'Resumen de parto y postparto',
  obstetricMonitor: 'Monitorización obstétrica / partograma',
  immediatePostpartumPeriod: 'Puerperio inmediato',
  postpartumControl: 'Control de puerperio',
  maternalDischargeForm: 'Egreso materno',
  maternalReadmissionForm: 'Reingreso materno',
  obstetricsServiceForm: 'Servicio de obstetricia',
  adolescentPregnancyCareForm: 'Atención diferenciada de gestante adolescente',
  obstetricReferralForm: 'Referencia/contrarreferencia obstétrica',
  culturalBirthPreferencesForm: 'Pertinencia cultural y preferencia de parto',
  perinatalMentalHealthForm: 'Salud mental perinatal',
  maternalViolenceScreeningForm: 'Tamizaje de violencia gestante',
  familyPlanningCounselingForm: 'Consejería y método anticonceptivo',
  familyPlanningFollowupForm: 'Seguimiento de planificación familiar',
  cervicalCancerScreeningForm: 'Tamizaje cervical',
  breastCancerScreeningForm: 'Tamizaje de mama',
};

const formEditPrivileges: Record<MaternalFormKey, string> = {
  maternalHistory: prenatalCareEditPrivilege,
  currentPregnancy: prenatalCareEditPrivilege,
  atencionPrenatal: prenatalCareEditPrivilege,
  prenatalSupplementationForm: prenatalCareEditPrivilege,
  screeningIndicatorsForm: prenatalCareEditPrivilege,
  psychoprophylaxisForm: prenatalCareEditPrivilege,
  birthPlanForm: prenatalCareEditPrivilege,
  adolescentPregnancyCareForm: prenatalCareEditPrivilege,
  perinatalMentalHealthForm: prenatalCareEditPrivilege,
  maternalViolenceScreeningForm: prenatalCareEditPrivilege,
  deliveryOrAbortion: labourDeliveryEditPrivilege,
  SummaryOfLaborAndPostpartum: labourDeliveryEditPrivilege,
  obstetricMonitor: labourDeliveryEditPrivilege,
  obstetricsServiceForm: labourDeliveryEditPrivilege,
  obstetricReferralForm: labourDeliveryEditPrivilege,
  culturalBirthPreferencesForm: labourDeliveryEditPrivilege,
  immediatePostpartumPeriod: postnatalCareEditPrivilege,
  postpartumControl: postnatalCareEditPrivilege,
  maternalDischargeForm: postnatalCareEditPrivilege,
  maternalReadmissionForm: postnatalCareEditPrivilege,
  familyPlanningCounselingForm: familyPlanningEditPrivilege,
  familyPlanningFollowupForm: familyPlanningEditPrivilege,
  cervicalCancerScreeningForm: cancerPreventionEditPrivilege,
  breastCancerScreeningForm: cancerPreventionEditPrivilege,
};

function canEditMaternalForm(session: Session | null | undefined, editPrivilege: string) {
  const user = session?.user;
  return Boolean(
    session?.authenticated &&
      user?.uuid &&
      userHasAccess(maternalPatientChartPrivilege, user) &&
      maternalHealthPrivileges.some(
        ({ view, edit }) => edit === editPrivilege && userHasAccess(view, user) && userHasAccess(edit, user),
      ),
  );
}

const MaternalHealthFormsSelector: React.FC<DefaultPatientWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const workspaceProps = props.workspaceProps ?? {};
  const patientUuid = (props.patientUuid ?? workspaceProps.patientUuid ?? '') as string;
  const pendingLaunch = useRef<object | null>(null);
  useEffect(
    () => () => {
      pendingLaunch.current = null;
    },
    [],
  );
  const { pregnancyStartDate } = useCurrentPregnancy(patientUuid);
  const encounterUrl = patientUuid
    ? `${restBaseUrl}/encounter?patient=${patientUuid}&limit=100&v=custom:(uuid,encounterDatetime,form:(uuid,name,display))`
    : null;
  const { data: encounterData, mutate: mutateMaternalEncounters } = useSWR<EncounterResponse, Error>(
    encounterUrl,
    async (url) => {
      const response = await openmrsFetch<EncounterResponse>(url);
      return response.data;
    },
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

  const availableForms = useMemo<Array<CompletedFormInfo>>(() => {
    return maternalFormKeys.reduce<Array<CompletedFormInfo>>((forms, formKey) => {
      const formIdentifier = config.formsList[formKey]?.trim();
      if (!formIdentifier || !canEditMaternalForm(session, formEditPrivileges[formKey])) {
        return forms;
      }

      const label = formLabels[formKey] ?? formIdentifier;
      forms.push({
        form: {
          uuid: formIdentifier,
          name: label,
          display: label,
          version: '1',
          published: true,
          retired: false,
          resources: [],
        },
        associatedEncounters: [],
      });

      return forms;
    }, []);
  }, [config.formsList, session]);
  const formsWithHistory = useMemo<Array<CompletedFormInfo>>(
    () =>
      availableForms.map((formInfo) => {
        const matchingEncounters = (encounterData?.results ?? [])
          .filter(
            (encounter) =>
              encounterMatchesForm(encounter, formInfo.form.uuid) &&
              isWithinPregnancyEpisode(encounter.encounterDatetime, pregnancyStartDate),
          )
          .sort(
            (first, second) =>
              new Date(second.encounterDatetime).getTime() - new Date(first.encounterDatetime).getTime(),
          );
        const associatedEncounters = matchingEncounters.map((encounter) => ({
          uuid: encounter.uuid,
          encounterDatetime: encounter.encounterDatetime,
        }));

        return {
          ...formInfo,
          associatedEncounters,
          lastCompletedDate: associatedEncounters[0]?.encounterDatetime
            ? new Date(associatedEncounters[0].encounterDatetime)
            : undefined,
        };
      }),
    [availableForms, encounterData?.results, pregnancyStartDate],
  );

  const launchForm = useCallback(
    async (form: Form, encounterUuid: string, onFormSubmitted: () => void) => {
      const formKey = maternalFormKeys.find((key) => config.formsList[key]?.trim() === form.uuid);
      if (pendingLaunch.current || !formKey) {
        return;
      }
      const canLaunch = () => {
        const { loaded, session: currentSession } = getSessionStore().getState();
        return (
          loaded &&
          currentSession?.user?.uuid === session?.user?.uuid &&
          canEditMaternalForm(currentSession, formEditPrivileges[formKey])
        );
      };
      if (!canLaunch()) {
        return;
      }

      const request = {};
      pendingLaunch.current = request;
      try {
        const resolvedForm = await resolveMaternalForm(form.uuid, form.display ?? form.name);
        if (pendingLaunch.current !== request || !canLaunch()) {
          return;
        }
        await launchWorkspace2(formEntryWorkspace, {
          form: resolvedForm,
          encounterUuid,
          handlePostResponse: () => {
            onFormSubmitted();
            void mutateMaternalEncounters();
          },
        });
      } catch {
        if (pendingLaunch.current === request && canLaunch()) {
          showSnackbar({
            kind: 'error',
            title: t('maternalFormNotAvailable', 'Formulario materno no disponible'),
            subtitle: t(
              'maternalFormNotAvailableSubtitle',
              'Revise que el formulario esté publicado y que el UUID o nombre configurado sea exacto.',
            ),
          });
        }
      } finally {
        if (pendingLaunch.current === request) {
          pendingLaunch.current = null;
        }
      }
    },
    [config.formsList, mutateMaternalEncounters, session?.user?.uuid, t],
  );

  return (
    <FormsSelectorWorkspace
      availableForms={formsWithHistory}
      patientAge=""
      controlNumber={0}
      patientUuid={patientUuid}
      closeWorkspace={closeWorkspace}
      title={t('maternalHealthForms', 'Formularios de salud materna')}
      subtitle={t(
        'maternalHealthFormsInstructions',
        'Seleccione el formulario de salud materna que desea completar para esta paciente.',
      )}
      backWorkspace={null}
      onFormLaunch={launchForm}
      promptBeforeClosing={promptBeforeClosing}
      closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
      setTitle={setTitle}
    />
  );
};

const MaternalHealthFormsSelectorWorkspace: React.FC<DefaultPatientWorkspaceProps> = (props) => {
  const session = useSession();
  const canEdit = maternalHealthPrivileges.some(({ edit }) => canEditMaternalForm(session, edit));

  return canEdit ? (
    <MaternalHealthFormsSelector
      key={String(props.patientUuid ?? props.workspaceProps?.patientUuid ?? '')}
      {...props}
    />
  ) : (
    <UnauthorizedState privilege={maternalPatientChartPrivilege} />
  );
};

export default MaternalHealthFormsSelectorWorkspace;
