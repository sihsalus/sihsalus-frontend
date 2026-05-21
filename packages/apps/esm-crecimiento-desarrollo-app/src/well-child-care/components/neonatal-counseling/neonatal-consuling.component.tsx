import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { PatientSummaryTable } from '@sihsalus/esm-sihsalus-shared'; // Ajusta la ruta
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { useLatestValidEncounter } from '../../../hooks/useLatestEncounter'; // Ajusta la ruta
import { formEntryWorkspace } from '../../../types';

interface NeonatalCounselingProps {
  patientUuid: string;
}

const NeonatalCounseling: React.FC<NeonatalCounselingProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig() as ConfigObject;
  const { neonatalConcepts } = config;
  const headerTitle = t('neonatalCounseling', 'Consejeria Lactancia Materna');
  const { encounter, isLoading, error, mutate } = useLatestValidEncounter(
    patientUuid,
    config.encounterTypes.consejeriaMaterna,
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
      form: { uuid: config.formsList.breastfeedingObservation },
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
      id: 'examDate',
      label: t('examDate', 'Fecha y Hora de Inicio del Examen'),
      dataKey: neonatalConcepts.examDateUuid,
    },
    {
      id: 'bodyPosition',
      label: t('bodyPosition', 'Posición del Cuerpo'),
      dataKey: neonatalConcepts.bodyPositionUuid,
    },
    { id: 'responses', label: t('responses', 'Respuestas'), dataKey: neonatalConcepts.responsesUuid },
    {
      id: 'affectiveBond',
      label: t('affectiveBond', 'Vínculo Afectivo'),
      dataKey: neonatalConcepts.affectiveBondUuid,
    },
    { id: 'anatomy', label: t('anatomy', 'Anatomía'), dataKey: neonatalConcepts.anatomyUuid },
    { id: 'suction', label: t('suction', 'Succión'), dataKey: neonatalConcepts.suctionCounselUuid },
    { id: 'time', label: t('time', 'Tiempo'), dataKey: neonatalConcepts.timeUuid },
    {
      id: 'feedingTime',
      label: t('feedingTime', 'Tiempo que el Bebé Mamó (min)'),
      dataKey: neonatalConcepts.feedingTimeUuid,
    },
    { id: 'notes', label: t('notes', 'Notas'), dataKey: neonatalConcepts.observationUuid },
  ];

  return (
    <PatientSummaryTable
      patientUuid={patientUuid}
      headerTitle={headerTitle}
      displayText={t('neonatalCounseling', 'Consejeria Lactancia Materna')}
      dataHook={dataHook}
      rowConfig={rowConfig}
      onFormLaunch={handleLaunchForm}
    />
  );
};

export default NeonatalCounseling;
