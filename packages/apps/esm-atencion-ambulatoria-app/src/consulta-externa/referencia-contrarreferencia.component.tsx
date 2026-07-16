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
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useReferralCounterReferral } from '../hooks/useReferralCounterReferral';
import { patientFormEntryWorkspace } from '../utils/constants';
import ClinicalHistoryCard from './clinical-history-card.component';

interface ReferenciaContraReferenciaProps {
  patientUuid: string;
}

const ReferenciaContraReferencia: React.FC<ReferenciaContraReferenciaProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();

  const { entries, isLoading, isValidating, error, mutate, pagination } = useReferralCounterReferral(
    patientUuid,
    config.encounterTypes?.referralCounterReferral,
    config.encounterTypes?.externalConsultation,
    {
      referralUuid: config.concepts?.referralUuid,
      referralTypeUuid: config.concepts?.referralTypeUuid,
      referralReasonUuid: config.concepts?.referralReasonUuid,
      referralDestinationUuid: config.concepts?.referralDestinationUuid,
      counterReferralResponseUuid: config.concepts?.counterReferralResponseUuid,
    },
  );

  const handleLaunchForm = () => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      mutateForm: mutate,
      formInfo: {
        patientUuid,
        formUuid: config.formsList?.referralForm,
      },
    });
  };

  return (
    <ClinicalHistoryCard
      title={t('referralHistory', 'Historial de Referencias y Contrarreferencias')}
      actionLabel={t('addReferral', 'Registrar Referencia')}
      empty={entries.length === 0}
      emptyDisplayText={t('referralsAndCounterReferrals', 'referencias y contrarreferencias')}
      error={error}
      isLoading={isLoading}
      isValidating={isValidating}
      loadingVariant="accordion"
      onAction={handleLaunchForm}
      pagination={pagination}
    >
      <Accordion>
        {entries.map((entry) => {
          const hasCounterReferral = Boolean(entry.counterReferralResponse);
          return (
            <AccordionItem
              key={entry.uuid}
              title={
                <span>
                  {formatDate(new Date(entry.encounterDatetime), { time: true })}
                  {' — '}
                  <Tag type="outline" size="sm">
                    {entry.provider ?? t('unknownProvider', 'Proveedor desconocido')}
                  </Tag>
                  {hasCounterReferral && (
                    <Tag type="green" size="sm" style={{ marginLeft: '0.5rem' }}>
                      {t('counterReferralReceived', 'Contrarreferencia recibida')}
                    </Tag>
                  )}
                  {entry.source === 'interconsultationOrder' && (
                    <Tag type="purple" size="sm" style={{ marginLeft: '0.5rem' }}>
                      {t('interconsultationOrder', 'Orden de interconsulta')}
                    </Tag>
                  )}
                </span>
              }
            >
              <StructuredListWrapper isCondensed>
                <StructuredListHead>
                  <StructuredListRow head>
                    <StructuredListCell head>{t('field', 'Campo')}</StructuredListCell>
                    <StructuredListCell head>{t('value', 'Valor')}</StructuredListCell>
                  </StructuredListRow>
                </StructuredListHead>
                <StructuredListBody>
                  {entry.interconsultationOrder && (
                    <StructuredListRow>
                      <StructuredListCell>
                        <Tag type="purple" size="sm">
                          {t('interconsultationOrder', 'Orden de interconsulta')}
                        </Tag>
                      </StructuredListCell>
                      <StructuredListCell>{entry.interconsultationOrder}</StructuredListCell>
                    </StructuredListRow>
                  )}
                  {entry.referralType && (
                    <StructuredListRow>
                      <StructuredListCell>
                        <Tag type="magenta" size="sm">
                          {t('referralType', 'Tipo de Referencia')}
                        </Tag>
                      </StructuredListCell>
                      <StructuredListCell>{entry.referralType}</StructuredListCell>
                    </StructuredListRow>
                  )}
                  {entry.referralDestination && (
                    <StructuredListRow>
                      <StructuredListCell>
                        <Tag type="blue" size="sm">
                          {t('referralDestination', 'Establecimiento Destino')}
                        </Tag>
                      </StructuredListCell>
                      <StructuredListCell>{entry.referralDestination}</StructuredListCell>
                    </StructuredListRow>
                  )}
                  {entry.referralReason && (
                    <StructuredListRow>
                      <StructuredListCell>
                        <Tag type="cyan" size="sm">
                          {t('referralReason', 'Motivo de Referencia')}
                        </Tag>
                      </StructuredListCell>
                      <StructuredListCell>{entry.referralReason}</StructuredListCell>
                    </StructuredListRow>
                  )}
                  {entry.counterReferralResponse && (
                    <StructuredListRow>
                      <StructuredListCell>
                        <Tag type="green" size="sm">
                          {t('counterReferralResponse', 'Respuesta Contrarreferencia')}
                        </Tag>
                      </StructuredListCell>
                      <StructuredListCell>{entry.counterReferralResponse}</StructuredListCell>
                    </StructuredListRow>
                  )}
                  {!entry.referralType &&
                    !entry.referralDestination &&
                    !entry.referralReason &&
                    !entry.counterReferralResponse &&
                    !entry.interconsultationOrder && (
                      <StructuredListRow>
                        <StructuredListCell>
                          {t('referralFormPending', 'Datos pendientes — formulario de referencia no configurado aún.')}
                        </StructuredListCell>
                        <StructuredListCell>—</StructuredListCell>
                      </StructuredListRow>
                    )}
                </StructuredListBody>
              </StructuredListWrapper>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ClinicalHistoryCard>
  );
};

export default ReferenciaContraReferencia;
