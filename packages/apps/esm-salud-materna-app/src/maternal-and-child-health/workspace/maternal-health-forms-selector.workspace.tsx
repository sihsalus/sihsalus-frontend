import { launchWorkspace2, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import type { CompletedFormInfo, Form } from '@openmrs/esm-patient-common-lib';
import { FormsSelectorWorkspace } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import type { ConfigObject } from '../../config-schema';
import { useCurrentPregnancy } from '../../hooks/useCurrentPregnancy';
import { type DefaultPatientWorkspaceProps, formEntryWorkspace } from '../../types';
import {
  encounterMatchesForm,
  isWithinPregnancyEpisode,
  type MaternalEncounter,
} from '../../utils/pregnancy-episode-utils';

interface EncounterResponse {
  results: MaternalEncounter[];
}

const maternalFormKeys: Array<keyof ConfigObject['formsList']> = [
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
];

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

const MaternalHealthFormsSelectorWorkspace: React.FC<DefaultPatientWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const workspaceProps = props.workspaceProps ?? {};
  const patientUuid = (props.patientUuid ?? workspaceProps.patientUuid ?? '') as string;
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
      const formUuid = config.formsList[formKey];
      if (!formUuid) {
        return forms;
      }

      const label = formLabels[formKey] ?? formUuid;
      forms.push({
        form: {
          uuid: formUuid,
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
  }, [config.formsList]);
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
    (form: Form, encounterUuid: string, onFormSubmitted: () => void) => {
      launchWorkspace2(formEntryWorkspace, {
        form: { uuid: form.uuid },
        encounterUuid,
        handlePostResponse: () => {
          onFormSubmitted();
          void mutateMaternalEncounters();
        },
      });
    },
    [mutateMaternalEncounters],
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

export default MaternalHealthFormsSelectorWorkspace;
