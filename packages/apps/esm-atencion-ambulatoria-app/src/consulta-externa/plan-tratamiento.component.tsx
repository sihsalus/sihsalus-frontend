import {
  Accordion,
  AccordionItem,
  Button,
  InlineLoading,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useTreatmentPlan } from '../hooks/useTreatmentPlan';
import { patientFormEntryWorkspace } from '../utils/constants';
import styles from './consulta-externa-dashboard.scss';

interface PlanTratamientoProps {
  patientUuid: string;
}

const PlanTratamiento: React.FC<PlanTratamientoProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { treatmentPlans, isLoading } = useTreatmentPlan(
    patientUuid,
    config.encounterTypes?.externalConsultation,
    config.concepts,
  );

  const handleLaunchForm = () => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      formInfo: {
        patientUuid,
        formUuid: config.formsList?.consultaExternaForm,
      },
    });
  };

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Cargando...')} />;
  }

  const sections = [
    { key: 'labOrders', label: t('labOrders', 'Exámenes Auxiliares'), tagType: 'blue' as const },
    { key: 'procedures', label: t('procedures', 'Procedimientos'), tagType: 'teal' as const },
    { key: 'prescriptions', label: t('prescriptions', 'Receta Médica'), tagType: 'green' as const },
    {
      key: 'therapeuticIndications',
      label: t('therapeuticIndications', 'Indicaciones Terapéuticas'),
      tagType: 'purple' as const,
    },
    { key: 'referral', label: t('referral', 'Interconsulta / Referencia'), tagType: 'magenta' as const },
    { key: 'nextAppointment', label: t('nextAppointment', 'Próxima Cita'), tagType: 'cyan' as const },
  ];

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.tableHeader}>
        <span className={styles.tableHeaderTitle}>
          {t('treatmentPlanHistory', 'Historial de Planes de Tratamiento')}
        </span>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm}>
          {t('addTreatmentPlan', 'Registrar Plan')}
        </Button>
      </div>

      {treatmentPlans.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('noTreatmentPlanData', 'No hay planes de tratamiento registrados para este paciente.')}</p>
        </div>
      ) : (
        <Accordion>
          {treatmentPlans.map((plan) => (
            <AccordionItem
              key={plan.encounterUuid}
              title={
                <span>
                  {formatDate(new Date(plan.encounterDatetime))}
                  {' — '}
                  <Tag type="outline" size="sm">
                    {plan.provider || t('unknownProvider', 'Proveedor desconocido')}
                  </Tag>
                </span>
              }
            >
              <StructuredListWrapper isCondensed>
                <StructuredListHead>
                  <StructuredListRow head>
                    <StructuredListCell head>{t('section', 'Sección')}</StructuredListCell>
                    <StructuredListCell head>{t('details', 'Detalles')}</StructuredListCell>
                  </StructuredListRow>
                </StructuredListHead>
                <StructuredListBody>
                  {sections.map(({ key, label, tagType }) => {
                    const value = plan[key as keyof typeof plan];
                    if (!value) return null;
                    return (
                      <StructuredListRow key={key}>
                        <StructuredListCell>
                          <Tag type={tagType} size="sm">
                            {label}
                          </Tag>
                        </StructuredListCell>
                        <StructuredListCell>{value}</StructuredListCell>
                      </StructuredListRow>
                    );
                  })}
                </StructuredListBody>
              </StructuredListWrapper>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default PlanTratamiento;
