import {
  Accordion,
  AccordionItem,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useOutpatientFormLauncher } from '../hooks/useOutpatientFormLauncher';
import { useTreatmentPlan } from '../hooks/useTreatmentPlan';
import ClinicalHistoryCard from './clinical-history-card.component';

interface PlanTratamientoProps {
  patientUuid: string;
}

const PlanTratamiento: React.FC<PlanTratamientoProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { treatmentPlans, isLoading, isValidating, error, mutate, pagination } = useTreatmentPlan(
    patientUuid,
    config.encounterTypes?.externalConsultation,
    config.concepts,
  );

  const { launchForm } = useOutpatientFormLauncher({
    fallbackDisplay: t('treatmentPlan', 'Treatment Plan'),
    identifier: config.formsList?.consultaExternaForm,
    onSaved: mutate,
    patientUuid,
  });

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
    <ClinicalHistoryCard
      title={t('treatmentPlanHistory', 'Historial de Planes de Tratamiento')}
      actionLabel={t('addTreatmentPlan', 'Registrar Plan')}
      empty={treatmentPlans.length === 0}
      emptyDisplayText={t('treatmentPlans', 'planes de tratamiento')}
      error={error}
      isLoading={isLoading}
      isValidating={isValidating}
      loadingVariant="accordion"
      onAction={() => void launchForm()}
      pagination={pagination}
    >
      <Accordion>
        {treatmentPlans.map((plan) => (
          <AccordionItem
            key={plan.encounterUuid}
            title={
              <span>
                {formatDate(new Date(plan.encounterDatetime), { time: true })}
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
    </ClinicalHistoryCard>
  );
};

export default PlanTratamiento;
