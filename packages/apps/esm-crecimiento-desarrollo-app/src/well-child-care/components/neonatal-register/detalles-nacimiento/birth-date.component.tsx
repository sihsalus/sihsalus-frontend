import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../../config-schema';
import { credNeonatalEditPrivilege } from '../../../../constants';
import { useCREDFormLauncher } from '../../../../hooks/useCREDFormLauncher';
import { useLatestValidEncounter } from '../../../../hooks/useLatestEncounter'; // Ajusta la ruta
import PatientSummaryTable from '../../../../ui/patient-summary-table/patient-summary-table.component';

interface BirthDataProps {
  patientUuid: string;
}

const BirthDataTable: React.FC<BirthDataProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(credNeonatalEditPrivilege, session?.user);
  const config = useConfig() as ConfigObject;
  const { neonatalConcepts } = config;
  const headerTitle = t('birthData', 'Datos del Nacimiento');
  const { encounter, isLoading, error, mutate } = useLatestValidEncounter(
    patientUuid,
    config.encounterTypes.antecedentesPerinatales,
    config.formsList.birthDetails,
  );
  const { launchForm } = useCREDFormLauncher('birthDetails');

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
    // Datos antropométricos al nacer
    {
      id: 'gestationalAge',
      label: t('gestationalAgeAtBorn', 'Edad Gestacional al Nacer'),
      dataKey: neonatalConcepts.gestationalAgeUuid,
      unit: t('weeks', 'semanas'),
    },
    {
      id: 'birthWeight',
      label: t('birthWeight', 'Peso al Nacer'),
      dataKey: neonatalConcepts.birthWeightUuid,
      unit: t('kg', 'kg'),
    },
    {
      id: 'birthHeight',
      label: t('birthHeight', 'Talla al Nacer'),
      dataKey: neonatalConcepts.birthHeightUuid,
      unit: t('cm', 'cm'),
    },
    {
      id: 'headCircumference',
      label: t('headCircumference', 'Head circumference'),
      dataKey: neonatalConcepts.headCircumferenceUuid,
      unit: t('cm', 'cm'),
    },
    {
      id: 'chestCircumference',
      label: t('chestCircumference', 'Chest circumference'),
      dataKey: neonatalConcepts.chestCircumferenceUuid,
      unit: t('cm', 'cm'),
    },
    {
      id: 'weightForGestationalAge',
      label: t('weightForGestationalAge', 'Peso para Edad Gestacional'),
      dataKey: neonatalConcepts.weightForGestationalAgeUuid,
    },

    // Evaluaciones APGAR
    {
      id: 'apgar1',
      label: t('apgar1', 'APGAR 1 minuto'),
      dataKey: neonatalConcepts.apgar1MinUuid,
      unit: t('points', 'puntos'),
    },
    {
      id: 'apgar5',
      label: t('apgar5', 'APGAR 5 minutos'),
      dataKey: neonatalConcepts.apgar5MinUuid,
      unit: t('points', 'puntos'),
    },

    // Condiciones médicas
    {
      id: 'congenitalDisease',
      label: t('congenitalDisease', 'Enfermedad Congénita'),
      dataKey: neonatalConcepts.congenitalDiseaseUuid,
    },
    {
      id: 'skinToSkinContact',
      label: t('skinToSkinContact', 'Contacto Piel a Piel'),
      dataKey: neonatalConcepts.skinToSkinContactUuid,
    },
    {
      id: 'roomingIn',
      label: t('roomingIn', 'Alojamiento conjunto'),
      dataKey: neonatalConcepts.roomingInUuid,
    },
    {
      id: 'breastfeedingFirstHour',
      label: t('breastfeedingFirstHour', 'Lactancia Primera Hora'),
      dataKey: neonatalConcepts.breastfeedingFirstHourUuid,
    },

    // Hospitalización
    {
      id: 'requiredHospitalization',
      label: t('requiredHospitalization', 'Requirió Hospitalización'),
      dataKey: neonatalConcepts.requiredHospitalizationUuid,
    },
    {
      id: 'hospitalizationTime',
      label: t('hospitalizationTime', 'Tiempo de Hospitalización'),
      dataKey: neonatalConcepts.hospitalizationTimeUuid,
      unit: t('days', 'días'),
    },
  ];

  return (
    <PatientSummaryTable
      patientUuid={patientUuid}
      headerTitle={headerTitle}
      displayText={t('birthData', 'Datos del Nacimiento')}
      dataHook={dataHook}
      rowConfig={rowConfig}
      onFormLaunch={canEdit ? handleLaunchForm : undefined}
    />
  );
};

export default BirthDataTable;
