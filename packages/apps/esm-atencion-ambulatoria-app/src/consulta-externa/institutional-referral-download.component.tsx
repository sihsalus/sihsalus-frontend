import { Button } from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { createErrorHandler, showSnackbar, useConfig, usePatient } from '@openmrs/esm-framework';
import {
  fetchVisitInsurance,
  SELF_FINANCED_CONCEPT_UUID,
  SIS_CONCEPT_UUID,
  type VisitInsurance,
} from '@openmrs/esm-patient-common-lib';
import isEqual from 'lodash-es/isEqual';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import type { ReferralEntry } from '../hooks/useReferralCounterReferral';
import { getRecordedReferralServices, ReferralServicesError } from './institutional-referral.resource';
import {
  createInstitutionalReferralFileName,
  createInstitutionalReferralPdf,
  downloadInstitutionalReferralPdf,
} from './institutional-referral-pdf';
import { buildOutpatientVisitSummary, fetchOutpatientVisitSummarySource } from './outpatient-visit-summary.resource';
import { toSummaryPatient } from './outpatient-visit-summary-download.component';

interface InstitutionalReferralDownloadProps {
  entry: ReferralEntry;
  patientUuid: string;
}

const payerLabels: Record<string, string> = {
  [SIS_CONCEPT_UUID]: 'SIS',
  'f38b048f-ee8b-4244-b3eb-a47a34c38f04': 'EsSalud',
  '9348006a-0ed8-4251-a848-8045af20d4ed': 'EPS',
  'ec420364-fde1-452d-9c48-fafb4ea73a58': 'Seguro privado',
  '08a4d37a-a420-4292-8fb7-39e968934c92': 'SOAT / AFOCAT',
  'e94d4d1a-6959-4ba2-ab4b-aac3027b41e9': 'Fuerzas Armadas',
  '4e4f62f9-2171-4eef-8d67-1c7edc7735a8': 'Sanidad PNP',
  [SELF_FINANCED_CONCEPT_UUID]: 'Particular / sin seguro',
};

function getPayerLabel(insurance: VisitInsurance): string | null {
  return insurance.financiadorUuid ? (payerLabels[insurance.financiadorUuid] ?? 'Otro seguro registrado') : null;
}

const InstitutionalReferralDownload: React.FC<InstitutionalReferralDownloadProps> = ({ entry, patientUuid }) => {
  const { t, i18n } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { patient, isLoading: isPatientLoading, error: patientError } = usePatient(patientUuid);
  const [isGenerating, setIsGenerating] = useState(false);
  const generationInProgress = useRef(false);
  const generationEpoch = useRef(0);

  // Compare the values used by the document. Hooks/history mapping may return
  // equivalent new objects on every render, including our own busy-state render.
  const generationContext = {
    patientUuid,
    patient: patient ? toSummaryPatient(patient) : null,
    isPatientLoading,
    hasPatientError: Boolean(patientError),
    language: i18n.language,
    referral: {
      uuid: entry.uuid,
      visitUuid: entry.visitUuid,
      encounterDatetime: entry.encounterDatetime,
      destination: entry.referralDestination,
      destinationCode: entry.referralDestinationCode,
      specialty: entry.referralDestinationSpecialtyOther || entry.referralDestinationSpecialty,
      priority: entry.referralType,
      patientCondition: entry.referralPatientCondition,
      transportMode: entry.referralTransportMode,
      reason: entry.referralReason,
    },
    config: {
      ambulatoryVisitType: config.visitTypes.ambulatory,
      facilityName: config.referralOriginFacilityName,
      renaesCode: config.referralOriginRenaesCode,
      professionalRegistration: config.professionalRegistrationProviderAttributeTypeUuid,
      clinicianRole: config.clinicianEncounterRoleUuid,
      visitNoteType: config.encounterTypes.visitNote,
      visitNoteForm: config.formsList.visitNoteFormUuid,
      referralType: config.encounterTypes.referralCounterReferral,
      concepts: config.concepts,
    },
  };
  const activeContext = useRef(generationContext);

  useLayoutEffect(() => {
    if (isEqual(activeContext.current, generationContext)) return;
    activeContext.current = generationContext;
    generationEpoch.current += 1;
    generationInProgress.current = false;
    setIsGenerating(false);
  });

  useLayoutEffect(
    () => () => {
      // The reads/PDF builder cannot be aborted. Invalidate their results on
      // unmount; old completions must not download or affect a newer operation.
      generationEpoch.current += 1;
      generationInProgress.current = false;
    },
    [],
  );

  const showError = useCallback(
    (subtitle: string) =>
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('referralDownloadError', 'No se pudo descargar la hoja de referencia'),
        subtitle,
      }),
    [t],
  );

  const handleDownload = useCallback(async () => {
    if (generationInProgress.current) return;
    if (!entry.visitUuid) {
      showError(
        t(
          'referralWithoutVisit',
          'Esta referencia histórica no está vinculada a una visita verificable y no puede componerse de forma segura.',
        ),
      );
      return;
    }
    if (isPatientLoading) {
      showError(t('outpatientSummaryPatientPending', 'Los datos del paciente todavía se están verificando.'));
      return;
    }
    if (patientError || !patient) {
      showError(t('outpatientSummaryPatientError', 'No se pudo verificar la identidad del paciente.'));
      return;
    }

    const summaryPatient = toSummaryPatient(patient);
    if (!summaryPatient || summaryPatient.uuid.toLowerCase() !== patientUuid.toLowerCase()) {
      showError(t('outpatientSummaryPatientMismatch', 'La identidad del paciente no coincide con la visita.'));
      return;
    }
    const genderLabels: Record<string, string> = {
      female: t('female', 'Femenino'),
      male: t('male', 'Masculino'),
      other: t('other', 'Otro'),
      unknown: t('unknown', 'No especificado'),
    };
    summaryPatient.gender = genderLabels[summaryPatient.gender ?? ''] ?? summaryPatient.gender;

    const operationEpoch = ++generationEpoch.current;
    const isCurrent = () => generationEpoch.current === operationEpoch;
    generationInProgress.current = true;
    setIsGenerating(true);
    try {
      const [source, insurance] = await Promise.all([
        fetchOutpatientVisitSummarySource(entry.visitUuid),
        fetchVisitInsurance(entry.visitUuid),
      ]);
      if (!isCurrent()) return;
      const summary = buildOutpatientVisitSummary({
        source,
        expectedVisitUuid: entry.visitUuid,
        expectedPatientUuid: patientUuid,
        expectedVisitTypeUuid: config.visitTypes.ambulatory,
        patient: summaryPatient,
        facilityName: config.referralOriginFacilityName,
        professionalRegistrationProviderAttributeTypeUuid: config.professionalRegistrationProviderAttributeTypeUuid,
        clinicianEncounterRoleUuid: config.clinicianEncounterRoleUuid,
        responsibleEncounterTypeUuid: config.encounterTypes.visitNote,
        responsibleFormUuid: config.formsList.visitNoteFormUuid,
        concepts: config.concepts,
      });
      const bytes = await createInstitutionalReferralPdf(
        {
          summary,
          referral: {
            ...getRecordedReferralServices(
              source,
              entry.uuid,
              config.encounterTypes.referralCounterReferral,
              config.concepts.referralDestinationServiceUuid,
            ),
            uuid: entry.uuid,
            encounterDatetime: entry.encounterDatetime,
            destinationName: entry.referralDestination ?? '—',
            destinationRenaesCode: entry.referralDestinationCode,
            specialty: entry.referralDestinationSpecialtyOther || entry.referralDestinationSpecialty,
            priority: entry.referralType,
            patientCondition: entry.referralPatientCondition,
            transportMode: entry.referralTransportMode,
            reason: entry.referralReason,
          },
          originRenaesCode: config.referralOriginRenaesCode,
          insurance: {
            payer: getPayerLabel(insurance),
            number: insurance.insuranceNumber,
          },
        },
        i18n.language || 'es-PE',
      );
      if (!isCurrent()) return;
      downloadInstitutionalReferralPdf(bytes, createInstitutionalReferralFileName(entry.encounterDatetime, entry.uuid));
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('referralDownloaded', 'Hoja de referencia descargada'),
        subtitle: t('referralDownloadedLocally', 'El documento se generó localmente en formato PDF.'),
      });
    } catch (error) {
      if (!isCurrent()) return;
      createErrorHandler()(error);
      showError(
        error instanceof Error && error.name === 'OutpatientPdfUnsupportedCharacterError'
          ? t(
              'outpatientPdfUnsupportedCharacters',
              'El documento contiene caracteres que no se pueden representar con seguridad. Revise el texto registrado o contacte a soporte.',
            )
          : error instanceof ReferralServicesError
            ? t(
                'referralServicesUnavailable',
                'Revise la referencia: no se pudieron verificar sus servicios de origen y destino. No se generó el documento.',
              )
            : t('referralDownloadRetry', 'Recargue la historia e intente nuevamente.'),
      );
    } finally {
      if (isCurrent()) {
        generationInProgress.current = false;
        setIsGenerating(false);
      }
    }
  }, [config, entry, i18n.language, isPatientLoading, patient, patientError, patientUuid, showError, t]);

  return (
    <Button disabled={isGenerating} kind="ghost" renderIcon={Download} size="sm" onClick={handleDownload}>
      {isGenerating ? t('generating', 'Generando...') : t('downloadReferralSheet', 'Descargar hoja de referencia')}
    </Button>
  );
};

export default InstitutionalReferralDownload;
