import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { credNeonatalEditPrivilege } from '../../../constants';
import { useCREDFormLauncher } from '../../../hooks/useCREDFormLauncher';
import { useLatestValidEncounter } from '../../../hooks/useLatestEncounter'; // Ajusta la ruta
import PatientSummaryTable from '../../../ui/patient-summary-table/patient-summary-table.component';

interface ImmediateNewbornAttentionProps {
  patientUuid: string;
}

const NeonatalAttention: React.FC<ImmediateNewbornAttentionProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(credNeonatalEditPrivilege, session?.user);
  const config = useConfig() as ConfigObject;
  const { neonatalConcepts } = config;
  const headerTitle = t('immediateNewbornAttention', 'Atención inmediata del recién nacido');
  const displayText = t('immediateNewbornAttention', 'Atención inmediata del recién nacido');
  const { encounter, isLoading, error, mutate } = useLatestValidEncounter(
    patientUuid,
    config.encounterTypes.atencionInmediata,
    config.formsList.atencionImmediataNewborn,
  );
  const { launchForm } = useCREDFormLauncher('atencionImmediataNewborn');

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

  const handleLaunchForm = React.useCallback(() => {
    launchForm(encounter?.uuid || '', () => void mutate());
  }, [encounter?.uuid, launchForm, mutate]);

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
    { id: 'apgar1Min', label: t('apgar1Min', 'Apgar 1 Minuto'), dataKey: neonatalConcepts.apgar1MinUuid },
    { id: 'apgar5Min', label: t('apgar5Min', 'Apgar 5 Minutos'), dataKey: neonatalConcepts.apgar5MinUuid },
    {
      id: 'apgar10Min',
      label: t('apgar10Min', 'Apgar 10 Minutos'),
      dataKey: neonatalConcepts.apgar10MinUuid,
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
      onFormLaunch={canEdit ? handleLaunchForm : undefined}
    />
  );
};

export default NeonatalAttention;
