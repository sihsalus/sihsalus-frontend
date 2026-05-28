import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { useCallback } from 'react';

import { type ConfigObject } from '../config-schema';
import { type Form, formEntryWorkspace } from '../types';

/**
 * Custom hook for launching CRED forms with workspace functionality
 * Similar to useLaunchVitalsAndBiometricsForm but specific to CRED forms
 */
export function useLaunchCREDForm(_patientUuid: string) {
  const config = useConfig<ConfigObject>();

  const launchCREDForm = useCallback((form: Form, encounterUuid: string = '') => {
    launchWorkspace2(formEntryWorkspace, {
      form,
      encounterUuid,
    });
  }, []);

  /**
   * Launch a specific CRED form by its UUID from config
   * @param formKey - The key from config.formsList (e.g., 'eedp2Months', 'tepsi')
   * @param encounterUuid - Optional encounter UUID for editing existing encounter
   */
  const launchCREDFormByKey = useCallback(
    (formKey: keyof ConfigObject['formsList'], encounterUuid: string = '') => {
      const formUuid = config.formsList[formKey];

      if (!formUuid) {
        console.warn(`Form UUID not found for key: ${formKey}`);
        return;
      }

      // Create a Form object from the config
      const form: Form = {
        uuid: formUuid,
        name: formKey,
        display: getFormDisplayName(formKey),
        version: '1.0',
        published: true,
        retired: false,
        resources: [],
        formCategory: 'CRED',
      };

      launchCREDForm(form, encounterUuid);
    },
    [config.formsList, launchCREDForm],
  );

  /**
   * Launch form for nutrition evaluation based on age
   */
  const launchNutritionEvaluation = useCallback(
    (patientAge: number, encounterUuid: string = '') => {
      const formKey = patientAge <= 5 ? 'childFeeding0to5' : 'childFeeding6to42';
      launchCREDFormByKey(formKey, encounterUuid);
    },
    [launchCREDFormByKey],
  );

  /**
   * Launch EEDP form based on age in months
   */
  const launchEEDPForm = useCallback(
    (ageInMonths: number, encounterUuid: string = '') => {
      let formKey: keyof ConfigObject['formsList'];

      if (ageInMonths <= 3) {
        formKey = 'eedp2Months';
      } else if (ageInMonths <= 6) {
        formKey = 'eedp5Months';
      } else if (ageInMonths <= 10) {
        formKey = 'eedp8Months';
      } else if (ageInMonths <= 14) {
        formKey = 'eedp12Months';
      } else if (ageInMonths <= 17) {
        formKey = 'eedp15Months';
      } else if (ageInMonths <= 20) {
        formKey = 'eedp18Months';
      } else if (ageInMonths <= 24) {
        formKey = 'eedp21Months';
      } else {
        // For children older than 24 months, use TEPSI
        formKey = 'tepsi';
      }

      launchCREDFormByKey(formKey, encounterUuid);
    },
    [launchCREDFormByKey],
  );

  return {
    launchCREDForm,
    launchCREDFormByKey,
    launchNutritionEvaluation,
    launchEEDPForm,
  };
}

/**
 * Get display name for form based on config key
 */
function getFormDisplayName(formKey: string): string {
  const displayNames: Record<string, string> = {
    // EEDP Forms
    eedp2Months: 'EEDP - 2 meses',
    eedp5Months: 'EEDP - 5 meses',
    eedp8Months: 'EEDP - 8 meses',
    eedp12Months: 'EEDP - 12 meses',
    eedp15Months: 'EEDP - 15 meses',
    eedp18Months: 'EEDP - 18 meses',
    eedp21Months: 'EEDP - 21 meses',
    tepsi: 'TEPSI',

    // Assessment Forms
    riskInterview0to30: 'Entrevista de Factores de Riesgo (0-30 meses)',
    childFeeding0to5: 'Evaluación de Alimentación (0-5 meses)',
    childFeeding6to42: 'Evaluación de Alimentación (6-42 meses)',
    childAbuseScreening: 'Tamizaje de Violencia y Maltrato Infantil',

    // Clinical Forms
    nursingAssessment: 'Valoración de Enfermería',
    medicalOrders: 'Órdenes Médicas',
    medicalProgressNote: 'Nota de Evolución Médica',
    epicrisis: 'Epicrisis',

    // Newborn Forms
    atencionImmediataNewborn: 'Atención inmediata del recién nacido',
    breastfeedingObservation: 'Observación del Amamantamiento',
    newbornNeuroEval: 'Evaluación Céfalo-Caudal y Neurológico',
    roomingIn: 'Alojamiento conjunto',
    birthDetails: 'Detalles de Nacimiento',
    pregnancyDetails: 'Embarazo y Parto',

    // NTS 238 forms
    ediDevelopmentForm: 'EDI',
    autismScreeningForm: 'Tamizaje TEA',
    childMentalHealthForm: 'Salud mental niño y cuidador',
    parasitosisScreeningForm: 'Descarte de parasitosis',
    vitaminAAdministrationForm: 'Administración de vitamina A',
    physicalExamForm: 'Examen físico integral',
    growthNutritionEvaluationForm: 'Crecimiento y estado nutricional',
    oralHealthInspectionForm: 'Inspección de cavidad bucal',
    visualScreeningForm: 'Tamizaje visual',
    hearingScreeningForm: 'Evaluación auditiva',
    cancerWarningSignsForm: 'Signos de sospecha de cáncer',
    metalsExposureScreeningForm: 'Exposición a metales pesados',
    violenceDisciplineScreeningForm: 'Violencia, disciplina y castigo físico',
    credCounselingAgreementForm: 'Consejería, acuerdos y compromisos',
    homeVisitFollowupForm: 'Visita domiciliaria y seguimiento',
    referralInterconsultationForm: 'Interconsulta, derivación o referencia',
    schoolHealthCounselingForm: 'Consejería escolar y lonchera saludable',
    adverseReactionForm: 'Reporte ESAVI',
    nutritionalAssessmentForm: 'Evaluación nutricional',
    feedingCounselingForm: 'Consejería alimentaria',
    nutritionFollowupForm: 'Seguimiento nutricional',
  };

  return displayNames[formKey] || formKey;
}
