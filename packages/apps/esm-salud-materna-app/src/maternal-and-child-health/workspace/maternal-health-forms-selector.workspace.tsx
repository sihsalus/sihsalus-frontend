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
  'screeningIndicatorsForm',
  'birthPlanForm',
  'deliveryOrAbortion',
  'SummaryOfLaborAndPostpartum',
  'immediatePostpartumPeriod',
  'postpartumControl',
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
  screeningIndicatorsForm: 'Tamizaje prenatal',
  birthPlanForm: 'Plan de parto',
  deliveryOrAbortion: 'Parto o aborto',
  SummaryOfLaborAndPostpartum: 'Resumen de parto y postparto',
  immediatePostpartumPeriod: 'Puerperio inmediato',
  postpartumControl: 'Control de puerperio',
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
      {...props}
      availableForms={availableForms}
      patientAge=""
      controlNumber={0}
      title={t('maternalHealthForms', 'Formularios de salud materna')}
      subtitle={t(
        'maternalHealthFormsInstructions',
        'Seleccione el formulario de salud materna que desea completar para esta paciente.',
      )}
      backWorkspace={null}
      onFormLaunch={launchForm}
    />
  );
};

export default MaternalHealthFormsSelectorWorkspace;
