import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema'; // Ajusta la ruta
import { credNeonatalEditPrivilege } from '../../../constants';
import { useCREDFormLauncher } from '../../../hooks/useCREDFormLauncher';
import { useLatestValidEncounter } from '@openmrs/esm-patient-common-lib';
import PatientSummaryTable from '../../../ui/patient-summary-table/patient-summary-table.component';

interface CephaloCaudalNeurologicalEvaluationProps {
  patientUuid: string;
}

const CephaloCaudalNeurologicalEvaluationTable: React.FC<CephaloCaudalNeurologicalEvaluationProps> = ({
  patientUuid,
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(credNeonatalEditPrivilege, session?.user);
  const config = useConfig() as ConfigObject;
  const { neonatalConcepts } = config;
  const headerTitle = t('cephaloCaudalNeurologicalEvaluation', 'Cephalo-caudal and neurological evaluation');
  const { encounter, isLoading, error, mutate } = useLatestValidEncounter(
    patientUuid,
    config.encounterTypes.cefaloCaudal,
    config.formsList.newbornNeuroEval,
  );
  const { launchForm } = useCREDFormLauncher('newbornNeuroEval');

  const obsData = React.useMemo(() => {
    if (!encounter?.obs) return {};
    return encounter.obs.reduce((acc, obs) => {
      acc[obs.concept.uuid] = obs.value;
      return acc;
    }, {});
  }, [encounter]);

  const handleLaunchForm = React.useCallback(() => {
    launchForm(encounter?.uuid || '', () => void mutate());
  }, [encounter?.uuid, launchForm, mutate]);

  const dataHook = () => {
    return {
      data: encounter ? [obsData] : [],
      isLoading,
      error,
      mutate,
    };
  };
  const rowConfig = [
    { id: 'skinColor', label: t('skinColor', 'Color de Piel'), dataKey: neonatalConcepts.skinColorUuid },
    { id: 'fontanelle', label: t('fontanelle', 'Fontanela'), dataKey: neonatalConcepts.fontanelleUuid },
    { id: 'sutures', label: t('sutures', 'Suturas'), dataKey: neonatalConcepts.suturesUuid },
    { id: 'ears', label: t('ears', 'Orejas'), dataKey: neonatalConcepts.earsUuid },
    { id: 'nose', label: t('nose', 'Nariz'), dataKey: neonatalConcepts.noseUuid },
    { id: 'mouth', label: t('mouth', 'Boca'), dataKey: neonatalConcepts.mouthUuid },
    { id: 'neck', label: t('neck', 'Cuello'), dataKey: neonatalConcepts.neckUuid },
    { id: 'thorax', label: t('thorax', 'Tórax'), dataKey: neonatalConcepts.thoraxUuid },
    { id: 'nipples', label: t('nipples', 'Mamilas'), dataKey: neonatalConcepts.nipplesUuid },
    { id: 'clavicle', label: t('clavicle', 'Clavícula'), dataKey: neonatalConcepts.clavicleUuid },
    {
      id: 'esophagus',
      label: t('esophagus', 'Permeabilidad Esófago'),
      dataKey: neonatalConcepts.esophagusPermeabilityUuid,
    },
    {
      id: 'umbilicalCord',
      label: t('umbilicalCord', 'Cordón Umbilical'),
      dataKey: neonatalConcepts.umbilicalCordUuid,
    },
    {
      id: 'abdomenCharacteristics',
      label: t('abdomenCharacteristics', 'Características del Abdomen'),
      dataKey: neonatalConcepts.abdomenCharacteristicsUuid,
    },
    {
      id: 'genitourinary',
      label: t('genitourinary', 'Genito Urinario'),
      dataKey: neonatalConcepts.genitourinaryUuid,
    },
    { id: 'observation', label: t('observation', 'Observación'), dataKey: neonatalConcepts.observationUuid },
    {
      id: 'analPermeability',
      label: t('analPermeability', 'Permeabilidad Anal'),
      dataKey: neonatalConcepts.esophagusPermeabilityUuid,
    },
    {
      id: 'genitourinaryElimination',
      label: t('genitourinaryElimination', 'Eliminación Genito Urinario'),
      dataKey: neonatalConcepts.genitourinaryEliminationUuid,
    },
    {
      id: 'spinalColumn',
      label: t('spinalColumn', 'Columna Vertebral'),
      dataKey: neonatalConcepts.spinalColumnUuid,
    },
    { id: 'limbs', label: t('limbs', 'Extremidades'), dataKey: neonatalConcepts.limbsUuid },
    { id: 'muscleTone', label: t('muscleTone', 'Tono Muscular'), dataKey: neonatalConcepts.muscleToneUuid },
    { id: 'hip', label: t('hip', 'Cadera'), dataKey: neonatalConcepts.hipUuid },
    {
      id: 'neurologicalEvaluation',
      label: t('neurologicalEvaluation', 'Valoración Neurológica'),
      dataKey: neonatalConcepts.neurologicalEvaluationUuid,
    },
  ];

  return (
    <PatientSummaryTable
      patientUuid={patientUuid}
      headerTitle={headerTitle}
      displayText={t('cephaloCaudalNeurologicalEvaluation', 'Cephalo-caudal and neurological evaluation')}
      dataHook={dataHook}
      rowConfig={rowConfig}
      onFormLaunch={canEdit ? handleLaunchForm : undefined}
    />
  );
};

export default CephaloCaudalNeurologicalEvaluationTable;
