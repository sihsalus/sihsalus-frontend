import { useConfig } from '@openmrs/esm-framework';
import { PatientSummaryTable } from '@sihsalus/esm-sihsalus-shared'; // Ajusta la ruta
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../../config-schema'; // Ajusta la ruta
import { useCREDFormLauncher } from '../../../../hooks/useCREDFormLauncher';
import { useLatestValidEncounter } from '../../../../hooks/useLatestEncounter'; // Ajusta la ruta

interface PregnancyBirthProps {
  patientUuid: string;
}

const PregnancyBirthTable: React.FC<PregnancyBirthProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig() as ConfigObject;
  const { neonatalConcepts } = config;
  const headerTitle = t('pregnancyBirth', 'Pregnancy and birth');
  const { encounter, isLoading, error, mutate } = useLatestValidEncounter(
    patientUuid,
    config.encounterTypes.antecedentesPerinatales, // Asegúrate de tener este tipo de encounter configurado
  );
  const { launchForm } = useCREDFormLauncher('pregnancyDetails');

  const obsData = React.useMemo(() => {
    if (!encounter?.obs) return {};
    return encounter.obs.reduce((acc, obs) => {
      acc[obs.concept.uuid] = obs.value;
      return acc;
    }, {});
  }, [encounter]);

  const handleLaunchForm = React.useCallback(() => {
    launchForm(encounter?.uuid || '');
  }, [encounter?.uuid, launchForm]);

  const dataHook = () => {
    return {
      data: encounter ? [obsData] : [],
      isLoading,
      error,
      mutate,
    };
  };

  const rowConfig = [
    // SECCIÓN EMBARAZO
    {
      id: 'pregnancyNumber',
      label: t('pregnancyNumber', 'Nº de Embarazo (Gravida)'),
      dataKey: neonatalConcepts.pregnancyNumberUuid,
      sectionTitle: t('pregnancy', 'EMBARAZO'),
    },
    {
      id: 'prenatalCareNumber',
      label: t('prenatalCareNumber', 'Nº de Atenciones Prenatales'),
      dataKey: neonatalConcepts.prenatalCareNumberUuid,
    },
    {
      id: 'prenatalCareLocation',
      label: t('prenatalCareLocation', 'Lugar de Atenciones Prenatales'),
      dataKey: neonatalConcepts.prenatalCareLocationUuid,
    },

    // SECCIÓN PARTO
    {
      id: 'deliveryType',
      label: t('birthCondition', 'Birth condition'),
      dataKey: neonatalConcepts.deliveryConditionUuid,
      sectionTitle: t('delivery', 'PARTO'),
    },
    {
      id: 'deliveryLocation',
      label: t('deliveryLocation', 'Lugar del Parto'),
      dataKey: neonatalConcepts.deliveryLocationUuid,
    },
    {
      id: 'deliveryAttendant',
      label: t('deliveryAttendant', 'Atendido Por'),
      dataKey: neonatalConcepts.deliveryAttendantUuid,
    },
  ];

  return (
    <PatientSummaryTable
      patientUuid={patientUuid}
      headerTitle={headerTitle}
      displayText={t('pregnancyBirth', 'Pregnancy and birth')}
      dataHook={dataHook}
      rowConfig={rowConfig}
      onFormLaunch={handleLaunchForm}
    />
  );
};

export default PregnancyBirthTable;
