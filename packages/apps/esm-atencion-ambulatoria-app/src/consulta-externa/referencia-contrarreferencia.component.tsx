import {
  Accordion,
  AccordionItem,
  Button,
  InlineLoading,
  InlineNotification,
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
import { useReferralCounterReferral } from '../hooks/useReferralCounterReferral';
import { patientFormEntryWorkspace } from '../utils/constants';
import styles from './consulta-externa-dashboard.scss';

interface ReferenciaContraReferenciaProps {
  patientUuid: string;
}

const ReferenciaContraReferencia: React.FC<ReferenciaContraReferenciaProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();

  const { entries, isLoading, error } = useReferralCounterReferral(
    patientUuid,
    config.encounterTypes?.referralCounterReferral,
    {
      referralTypeUuid: config.concepts?.referralTypeUuid,
      referralReasonUuid: config.concepts?.referralReasonUuid,
      referralDestinationUuid: config.concepts?.referralDestinationUuid,
      counterReferralResponseUuid: config.concepts?.counterReferralResponseUuid,
    },
  );

  const handleLaunchForm = () => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      formInfo: {
        patientUuid,
        formUuid: config.formsList?.referralForm,
      },
    });
  };

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Cargando...')} />;
  }

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.tableHeader}>
        <span className={styles.tableHeaderTitle}>
          {t('referralHistory', 'Historial de Referencias y Contrarreferencias')}
        </span>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm}>
          {t('addReferral', 'Registrar Referencia')}
        </Button>
      </div>

      {error && (
        <InlineNotification
          kind="error"
          lowContrast
          title={t('error', 'Error')}
          subtitle={t('errorLoadingReferrals', 'No se pudieron cargar las referencias.')}
        />
      )}

      {!error && entries.length === 0 && (
        <div className={styles.emptyState}>
          <p>{t('noReferralData', 'No hay referencias ni contrarreferencias registradas para este paciente.')}</p>
        </div>
      )}

      {entries.length > 0 && (
        <Accordion>
          {entries.map((entry) => {
            const hasCounterReferral = Boolean(entry.counterReferralResponse);
            return (
              <AccordionItem
                key={entry.uuid}
                title={
                  <span>
                    {formatDate(new Date(entry.encounterDatetime))}
                    {' — '}
                    <Tag type="outline" size="sm">
                      {entry.provider ?? t('unknownProvider', 'Proveedor desconocido')}
                    </Tag>
                    {hasCounterReferral && (
                      <Tag type="green" size="sm" style={{ marginLeft: '0.5rem' }}>
                        {t('counterReferralReceived', 'Contrarreferencia recibida')}
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
                      !entry.counterReferralResponse && (
                        <StructuredListRow>
                          <StructuredListCell>
                            {t(
                              'referralFormPending',
                              'Datos pendientes — formulario de referencia no configurado aún.',
                            )}
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
      )}
    </div>
  );
};

export default ReferenciaContraReferencia;
