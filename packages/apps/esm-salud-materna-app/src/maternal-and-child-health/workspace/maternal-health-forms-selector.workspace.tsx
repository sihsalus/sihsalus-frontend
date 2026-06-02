import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { FormsSelectorWorkspace } from '@sihsalus/esm-sihsalus-shared';
import type { CompletedFormInfo, Form } from '@sihsalus/esm-sihsalus-shared/src/ui/forms-selector/types';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../config-schema';
import { type DefaultPatientWorkspaceProps, formEntryWorkspace } from '../../types';

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

  const launchForm = useCallback((form: Form, encounterUuid: string) => {
    launchWorkspace2(formEntryWorkspace, {
      form: { uuid: form.uuid },
      encounterUuid,
    });
  }, []);

  return (
    <FormsSelectorWorkspace
      availableForms={availableForms}
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
