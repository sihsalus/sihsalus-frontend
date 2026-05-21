import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { PatientSummaryTable } from '@sihsalus/esm-sihsalus-shared'; // Ajusta la ruta
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { useLatestValidEncounter } from '../../../hooks/useLatestEncounter'; // Ajusta la ruta
import { formEntryWorkspace } from '../../../types';

interface ImmediateNewbornAttentionProps {
  patientUuid: string;
}

const NeonatalAttention: React.FC<ImmediateNewbornAttentionProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig() as ConfigObject;
  const { neonatalConcepts } = config;
  const headerTitle = t('immediateNewbornAttention', 'Atención Inmediata del Recién Nacido');
  const displayText = t('immediateNewbornAttention', 'Atención Inmediata del Recién Nacido');
  const { encounter, isLoading, error, mutate } = useLatestValidEncounter(
    patientUuid,
    config.encounterTypes.atencionInmediata,
  );

  // Procesar observaciones, manejando múltiples valores para checkboxes
  const obsData = React.useMemo(() => {
    if (!encounter?.obs) return {};
    const obsMap: { [key: string]: string | string[] } = {};
    encounter.obs.forEach((obs) => {
      const conceptUuid = obs.concept.uuid;
      const value =
        obs.value && typeof obs.value === 'object' && 'display' in obs.value ? obs.value.display : obs.value;
      if (obsMap[conceptUuid]) {
        // Si ya existe, convertir a array para checkboxes
        obsMap[conceptUuid] = Array.isArray(obsMap[conceptUuid])
          ? [...obsMap[conceptUuid], value]
          : [obsMap[conceptUuid], value];
      } else {
        obsMap[conceptUuid] = value;
      }
    });
    return obsMap;
  }, [encounter]);

  const handleLaunchForm = () => {
    launchWorkspace2(formEntryWorkspace, {
      form: { uuid: config.formsList.atencionImmediataNewborn },
      encounterUuid: encounter?.uuid || '',
    });
    setTimeout(() => mutate(), 1000); // Forzar revalidación
  };

  const dataHook = () => ({
    data: encounter ? [obsData] : [],
    isLoading,
    error,
    mutate,
  });

  const rowConfig = [
    {
      id: 'immediateAssessment',
      label: t('immediateAssessment', 'Valoración Inmediata del Recién Nacido'),
      dataKey: neonatalConcepts.immediateAssessmentUuid,
    },
    {
      id: 'birthQuestionnaire',
      label: t('birthQuestionnaire', 'Cuestionario Inmediato para Nacimiento'),
      dataKey: neonatalConcepts.birthQuestionnaireUuid,
    },
    {
      id: 'newbornEvaluation',
      label: t('newbornEvaluation', 'Evaluación del Recién Nacido'),
      dataKey: neonatalConcepts.newbornEvaluationUuid,
    },
    { id: 'cordClamping', label: t('cordClamping', 'Clampado'), dataKey: neonatalConcepts.cordClampingUuid },
    {
      id: 'skinToSkinContact',
      label: t('skinToSkinContact', 'Contacto Piel a Piel'),
      dataKey: neonatalConcepts.skinToSkinContactUuid,
    },
    {
      id: 'oxygenSupport',
      label: t('oxygenSupport', 'Soporte de Oxígeno'),
      dataKey: neonatalConcepts.oxygenSupportUuid,
    },
    {
      id: 'vitaminKAdmin',
      label: t('vitaminKAdmin', 'Administración de Vitamina K'),
      dataKey: neonatalConcepts.vitaminKAdminUuid,
    },
    { id: 'heartRate', label: t('heartRate', 'Frecuencia Cardíaca'), dataKey: neonatalConcepts.heartRateUuid },
    {
      id: 'respiratoryRate',
      label: t('respiratoryRate', 'Frecuencia Respiratoria'),
      dataKey: neonatalConcepts.respiratoryRateUuid,
    },
    {
      id: 'oxygenSaturation',
      label: t('oxygenSaturation', 'Saturación de Oxígeno'),
      dataKey: neonatalConcepts.oxygenSaturationUuid,
    },
    {
      id: 'bodyTemperature',
      label: t('bodyTemperature', 'Temperatura Corporal'),
      dataKey: neonatalConcepts.bodyTemperatureUuid,
    },
    { id: 'apgar1Min', label: t('apgar1Min', 'Apgar 1 Minuto'), dataKey: neonatalConcepts.apgar1MinUuid },
    { id: 'apgar5Min', label: t('apgar5Min', 'Apgar 5 Minutos'), dataKey: neonatalConcepts.apgar5MinUuid },
    {
      id: 'apgar10Min',
      label: t('apgar10Min', 'Apgar 10 Minutos'),
      dataKey: neonatalConcepts.apgar10MinUuid,
    },
    { id: 'weight', label: t('weightKg', 'Weight (kg)'), dataKey: neonatalConcepts.weightUuid },
    { id: 'height', label: t('heightCm', 'Height (cm)'), dataKey: neonatalConcepts.heightUuid },
    {
      id: 'headCircumference',
      label: t('headCircumferenceCm', 'Head circumference (cm)'),
      dataKey: neonatalConcepts.headCircumferenceUuid,
    },
    {
      id: 'chestCircumference',
      label: t('chestCircumferenceCm', 'Chest circumference (cm)'),
      dataKey: neonatalConcepts.chestCircumferenceUuid,
    },
    {
      id: 'gastricLavage',
      label: t('gastricLavage', 'Lavado Gástrico'),
      dataKey: neonatalConcepts.gastricLavageUuid,
    },
    {
      id: 'gastricLavageCount',
      label: t('gastricLavageCount', 'Cantidad de Lavados Gástricos'),
      dataKey: neonatalConcepts.gastricLavageCountUuid,
    },
    {
      id: 'nursingDiagnosis',
      label: t('nursingDiagnosis', 'Diagnóstico de Enfermería'),
      dataKey: neonatalConcepts.nursingDiagnosisUuid,
    },
  ];

  return (
    <PatientSummaryTable
      patientUuid={patientUuid}
      headerTitle={headerTitle}
      displayText={displayText}
      dataHook={dataHook}
      rowConfig={rowConfig}
      onFormLaunch={handleLaunchForm}
    />
  );
};

export default NeonatalAttention;
