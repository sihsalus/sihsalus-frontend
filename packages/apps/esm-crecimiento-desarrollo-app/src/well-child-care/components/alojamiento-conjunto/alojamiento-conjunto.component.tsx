import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { credNeonatalEditPrivilege } from '../../../constants';
import { useCREDFormLauncher } from '../../../hooks/useCREDFormLauncher';
import { useLatestValidEncounter } from '../../../hooks/useLatestEncounter';
import PatientSummaryTable from '../../../ui/patient-summary-table/patient-summary-table.component';

interface AlojamientoConjuntoProps {
  patientUuid: string;
}

const AlojamientoConjunto: React.FC<AlojamientoConjuntoProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(credNeonatalEditPrivilege, session?.user);
  const config = useConfig() as ConfigObject;
  const { neonatalConcepts } = config;
  const headerTitle = t('alojamientoConjunto', 'Alojamiento conjunto');
  const { encounter, isLoading, error, mutate } = useLatestValidEncounter(
    patientUuid,
    config.encounterTypes.alojamientoConjunto,
    config.formsList.roomingIn,
  );
  const { launchForm } = useCREDFormLauncher('roomingIn');

  const obsData = React.useMemo(() => {
    if (!encounter?.obs) return {};
    return encounter.obs.reduce((acc, obs) => {
      if (obs?.concept?.uuid && obs.value !== undefined) {
        acc[obs.concept.uuid] = obs.value;
      }
      return acc;
    }, {});
  }, [encounter]);

  const handleLaunchForm = React.useCallback(() => {
    launchForm(encounter?.uuid || '', () => void mutate());
  }, [encounter?.uuid, launchForm, mutate]);

  const dataHook = React.useCallback(() => {
    return {
      data: encounter ? [obsData] : [],
      isLoading,
      error,
      mutate,
    };
  }, [encounter, obsData, isLoading, error, mutate]);

  if (!patientUuid || typeof patientUuid !== 'string') {
    return <div>{t('invalidPatientUuidError', 'Error: UUID de paciente inválido')}</div>;
  }

  const rowConfig = [
    // Datos Generales
    {
      id: 'fechaYHoraDeIngreso',
      label: t('fechaYHoraDeIngreso', 'Fecha y hora de ingreso'),
      dataKey: neonatalConcepts.admissionDateTimeUuid,
    },
    {
      id: 'edadGestacional',
      label: t('edadGestacional', 'Edad Gestacional (semanas)'),
      dataKey: neonatalConcepts.gestationalAgeUuid,
    },
    {
      id: 'hematocrito',
      label: t('hematocrito', 'Hematocrito (%)'),
      dataKey: neonatalConcepts.hematocritUuid,
    },

    // Valoración de enfermería al ingreso - En la madre
    {
      id: 'edadDeLaMadre',
      label: t('edadDeLaMadre', 'Edad de la madre'),
      dataKey: neonatalConcepts.motherAgeUuid,
    },
    {
      id: 'numeroDeHijos',
      label: t('numeroDeHijos', 'Número de hijos'),
      dataKey: neonatalConcepts.numberOfChildrenUuid,
    },
    {
      id: 'tipoDeParto',
      label: t('tipoDeParto', 'Tipo de parto'),
      dataKey: neonatalConcepts.deliveryTypeAcUuid,
    },
    {
      id: 'pezones',
      label: t('pezones', 'Pezones'),
      dataKey: neonatalConcepts.nipplesAcUuid,
    },
    {
      id: 'produccionLactea',
      label: t('produccionLactea', 'Producción Láctea'),
      dataKey: neonatalConcepts.milkProductionUuid,
    },

    // Valoración de enfermería al ingreso - En el recién nacido
    {
      id: 'agarre',
      label: t('agarre', 'Agarre'),
      dataKey: neonatalConcepts.latchUuid,
    },
    {
      id: 'succion',
      label: t('succion', 'Succión'),
      dataKey: neonatalConcepts.suctionAcUuid,
    },
    {
      id: 'deglucion',
      label: t('deglucion', 'Deglución'),
      dataKey: neonatalConcepts.swallowingUuid,
    },
    {
      id: 'diagnosticoDeEnfermeria',
      label: t('diagnosticoDeEnfermeria', 'Diagnóstico de Enfermería'),
      dataKey: neonatalConcepts.nursingDiagnosisAcUuid,
    },
    {
      id: 'intervencionDeEnfermeria',
      label: t('intervencionDeEnfermeria', 'Intervención de enfermería'),
      dataKey: neonatalConcepts.nursingInterventionUuid,
    },
  ];

  return (
    <PatientSummaryTable
      patientUuid={patientUuid}
      headerTitle={headerTitle}
      displayText={t('alojamientoConjunto', 'Alojamiento conjunto')}
      dataHook={dataHook}
      rowConfig={rowConfig}
      onFormLaunch={canEdit ? handleLaunchForm : undefined}
    />
  );
};

export default AlojamientoConjunto;
