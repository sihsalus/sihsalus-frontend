import {
  Accordion,
  AccordionItem,
  ContentSwitcher,
  Switch,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { formatDate, launchWorkspace2, showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useAmbulatoryVisitGuard } from '../hooks';
import { type ReferralEntry, useReferralCounterReferral } from '../hooks/useReferralCounterReferral';
import { consultaExternaEditPrivilege, institutionalReferralWorkspace } from '../utils/constants';
import ClinicalHistoryCard from './clinical-history-card.component';
import InstitutionalReferralDownload from './institutional-referral-download.component';
import styles from './consulta-externa-dashboard.scss';

interface ReferenciaContraReferenciaProps {
  patientUuid: string;
}

type ReferralView = 'referrals' | 'counterReferrals';

function hasReferralData(entry: ReferralEntry): boolean {
  return Boolean(
    entry.referralType ||
      entry.referralDestination ||
      entry.referralReason ||
      entry.referralDestinationSpecialty ||
      entry.referralPatientCondition ||
      entry.referralTransportMode,
  );
}

const ReferenciaContraReferencia: React.FC<ReferenciaContraReferenciaProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const [view, setView] = useState<ReferralView>('referrals');

  const { entries, isLoading, isValidating, error, mutate, pagination, sourceErrors } = useReferralCounterReferral(
    patientUuid,
    config.encounterTypes?.referralCounterReferral,
    {
      referralTypeUuid: config.concepts?.referralTypeUuid,
      referralReasonUuid: config.concepts?.referralReasonUuid,
      referralDestinationUuid: config.concepts?.referralDestinationUuid,
      referralDestinationSpecialtyUuid: config.concepts?.referralDestinationSpecialtyUuid,
      referralDestinationSpecialtyOtherUuid: config.concepts?.referralDestinationSpecialtyOtherUuid,
      referralPatientConditionUuid: config.concepts?.referralPatientConditionUuid,
      referralTransportModeUuid: config.concepts?.referralTransportModeUuid,
      counterReferralResponseUuid: config.concepts?.counterReferralResponseUuid,
      counterReferralConditionUuid: config.concepts?.counterReferralConditionUuid,
    },
    view,
  );

  const { requireAmbulatoryVisit } = useAmbulatoryVisitGuard({
    patientUuid,
    ambulatoryVisitTypeUuid: config.visitTypes.ambulatory,
  });
  const handleLaunchForm = useCallback(() => {
    const visit = requireAmbulatoryVisit();
    if (!visit) return;
    const locationUuid = visit.location?.uuid;
    if (!locationUuid) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('referralOpenError', 'No se pudo abrir la hoja de referencia'),
        subtitle: t(
          'referralLocationRequired',
          'La visita ambulatoria no tiene un establecimiento de atención verificable.',
        ),
      });
      return;
    }

    void launchWorkspace2(institutionalReferralWorkspace, {
      patientUuid,
      visitUuid: visit.uuid,
      locationUuid,
      onAfterSave: mutate,
    });
  }, [mutate, patientUuid, requireAmbulatoryVisit, t]);

  const showingReferrals = view === 'referrals';
  const title = showingReferrals
    ? t('issuedReferrals', 'Referencias emitidas')
    : t('receivedCounterReferrals', 'Contrarreferencias recibidas');
  const emptyDisplayText = showingReferrals
    ? t('issuedReferralsLower', 'referencias emitidas')
    : t('receivedCounterReferralsLower', 'contrarreferencias recibidas');

  return (
    <div className={styles.referralFlow}>
      <ContentSwitcher
        className={styles.referralFlowViews}
        selectedIndex={showingReferrals ? 0 : 1}
        onChange={({ index }) => setView(index === 0 ? 'referrals' : 'counterReferrals')}
        aria-label={t('referralCounterReferralViews', 'Vistas de referencia y contrarreferencia')}
      >
        <Switch name="referrals" text={t('issuedReferrals', 'Referencias emitidas')} />
        <Switch name="counterReferrals" text={t('receivedCounterReferrals', 'Contrarreferencias recibidas')} />
      </ContentSwitcher>
      <ClinicalHistoryCard
        title={title}
        actionLabel={showingReferrals ? t('addReferral', 'Registrar Referencia') : undefined}
        empty={entries.length === 0}
        emptyDisplayText={emptyDisplayText}
        editPrivilege={showingReferrals ? consultaExternaEditPrivilege : undefined}
        error={error}
        isLoading={isLoading}
        isValidating={isValidating}
        loadingVariant="accordion"
        onAction={showingReferrals ? handleLaunchForm : undefined}
        pagination={pagination}
        sourceErrors={sourceErrors}
      >
        <Accordion>
          {entries.map((entry) =>
            showingReferrals ? (
              <ReferralAccordionItem key={entry.uuid} entry={entry} patientUuid={patientUuid} />
            ) : (
              <CounterReferralAccordionItem key={entry.uuid} entry={entry} />
            ),
          )}
        </Accordion>
      </ClinicalHistoryCard>
    </div>
  );
};

function EncounterTitle({
  entry,
  showCounterReferralStatus = false,
}: {
  entry: ReferralEntry;
  showCounterReferralStatus?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <span>
      {formatDate(new Date(entry.encounterDatetime), { time: true })}
      {' — '}
      <Tag type="outline" size="sm">
        {entry.provider ?? t('unknownProvider', 'Proveedor desconocido')}
      </Tag>
      {showCounterReferralStatus && entry.counterReferralResponse ? (
        <Tag type="green" size="sm" className={styles.referralStatusTag}>
          {t('counterReferralReceived', 'Contrarreferencia recibida')}
        </Tag>
      ) : null}
    </span>
  );
}

function DetailsList({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();

  return (
    <StructuredListWrapper isCondensed>
      <StructuredListHead>
        <StructuredListRow head>
          <StructuredListCell head>{t('field', 'Campo')}</StructuredListCell>
          <StructuredListCell head>{t('value', 'Valor')}</StructuredListCell>
        </StructuredListRow>
      </StructuredListHead>
      <StructuredListBody>{children}</StructuredListBody>
    </StructuredListWrapper>
  );
}

function DetailRow({
  label,
  value,
  tagType,
}: {
  label: string;
  value: string;
  tagType: 'blue' | 'cyan' | 'green' | 'magenta';
}) {
  return (
    <StructuredListRow>
      <StructuredListCell>
        <Tag type={tagType} size="sm">
          {label}
        </Tag>
      </StructuredListCell>
      <StructuredListCell>{value}</StructuredListCell>
    </StructuredListRow>
  );
}

function ReferralAccordionItem({ entry, patientUuid }: { entry: ReferralEntry; patientUuid: string }) {
  const { t } = useTranslation();

  return (
    <AccordionItem title={<EncounterTitle entry={entry} showCounterReferralStatus />}>
      <DetailsList>
        {entry.referralType ? (
          <DetailRow label={t('referralType', 'Tipo de Referencia')} value={entry.referralType} tagType="magenta" />
        ) : null}
        {entry.referralDestination ? (
          <DetailRow
            label={t('referralDestination', 'Establecimiento Destino')}
            value={entry.referralDestination}
            tagType="blue"
          />
        ) : null}
        {entry.referralDestinationCode ? (
          <DetailRow label={t('renaesCode', 'Código RENIPRESS')} value={entry.referralDestinationCode} tagType="blue" />
        ) : null}
        {entry.referralDestinationSpecialty ? (
          <DetailRow
            label={t('destinationSpecialty', 'Especialidad de destino')}
            value={entry.referralDestinationSpecialtyOther || entry.referralDestinationSpecialty}
            tagType="magenta"
          />
        ) : null}
        {entry.referralPatientCondition ? (
          <DetailRow
            label={t('patientConditionAtDeparture', 'Condición del paciente a la salida')}
            value={entry.referralPatientCondition}
            tagType="cyan"
          />
        ) : null}
        {entry.referralTransportMode ? (
          <DetailRow label={t('transportMode', 'Transporte')} value={entry.referralTransportMode} tagType="green" />
        ) : null}
        {entry.referralReason ? (
          <DetailRow label={t('referralReason', 'Motivo de Referencia')} value={entry.referralReason} tagType="cyan" />
        ) : null}
        {!hasReferralData(entry) ? (
          <StructuredListRow>
            <StructuredListCell>
              {t('referralFormPending', 'Datos pendientes — formulario de referencia no configurado aún.')}
            </StructuredListCell>
            <StructuredListCell>—</StructuredListCell>
          </StructuredListRow>
        ) : null}
      </DetailsList>
      <div className={styles.referralActions}>
        <InstitutionalReferralDownload entry={entry} patientUuid={patientUuid} />
      </div>
    </AccordionItem>
  );
}

function CounterReferralAccordionItem({ entry }: { entry: ReferralEntry }) {
  const { t } = useTranslation();

  return (
    <AccordionItem title={<EncounterTitle entry={entry} />}>
      <DetailsList>
        {entry.referralDestination ? (
          <DetailRow
            label={t('referralOfOrigin', 'Referencia de origen')}
            value={entry.referralDestination}
            tagType="blue"
          />
        ) : null}
        {entry.counterReferralResponse ? (
          <DetailRow
            label={t('counterReferralResponse', 'Respuesta de contrarreferencia')}
            value={entry.counterReferralResponse}
            tagType="green"
          />
        ) : null}
        {entry.counterReferralCondition ? (
          <DetailRow
            label={t('patientReturnCondition', 'Condición del paciente al retorno')}
            value={entry.counterReferralCondition}
            tagType="cyan"
          />
        ) : null}
      </DetailsList>
    </AccordionItem>
  );
}

export default ReferenciaContraReferencia;
