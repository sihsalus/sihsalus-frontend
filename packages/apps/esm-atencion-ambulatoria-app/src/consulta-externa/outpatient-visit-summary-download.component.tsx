import { Button } from '@carbon/react';
import { Download, Printer } from '@carbon/react/icons';
import { createErrorHandler, showSnackbar, useConfig, usePatient, useSession } from '@openmrs/esm-framework';
import type { TFunction } from 'i18next';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useAmbulatoryVisitGuard } from '../hooks';
import { formatDeceasedName } from '../utils/utils';
import styles from './consulta-externa-dashboard.scss';
import { useOutpatientFacilityIdentity } from './outpatient-facility.resource';
import { fetchNextScheduledAppointment, isUpcomingScheduledAppointment } from './outpatient-next-appointment.resource';
import { printPdfBytes } from './outpatient-pdf-print';
import { fetchProviderCollegiateNumber, generateRecetaUnicaNumber } from './receta-unica.resource';
import {
  buildOutpatientVisitSummary,
  fetchOutpatientVisitSummarySource,
  getLinkedAppointmentUuids,
  type OutpatientSummaryPatient,
  type OutpatientVisitSummary,
} from './outpatient-visit-summary.resource';
import {
  hasOutpatientRecetaUnicaContent,
  type OutpatientRecetaUnicaPdfLabels,
  createOutpatientRecetaUnicaFileName,
  createOutpatientRecetaUnicaPdf,
  createOutpatientPatientInstructionsFileName,
  createOutpatientPatientInstructionsPdf,
  createOutpatientVisitSummaryFileName,
  createOutpatientVisitSummaryPdf,
  downloadOutpatientVisitSummaryPdf,
  hasOutpatientPatientInstructions,
  type OutpatientPatientInstructionsPdfLabels,
  type OutpatientVisitSummaryPdfLabels,
} from './outpatient-visit-summary-pdf';

interface OutpatientVisitSummaryDownloadProps {
  patientUuid: string;
}

type GenerationTarget = 'patient-instructions' | 'receta-unica' | 'visit-summary';
type IsGenerationCurrent = () => boolean;

interface VerifiedOutpatientSummary {
  linkedAppointmentUuids: string[];
  summary: OutpatientVisitSummary;
}

function getIdentifierLabel(identifier: fhir.Identifier): string {
  return (
    identifier.type?.text ??
    identifier.type?.coding?.find((coding) => coding.display)?.display ??
    identifier.system?.split('/').filter(Boolean).pop() ??
    'ID'
  );
}

function formatPatientAddress(patient: fhir.Patient): string | null {
  const address = patient.address?.find((candidate) => candidate.use === 'home') ?? patient.address?.[0];
  if (!address) return null;
  const parts = [
    ...(address.line ?? []),
    address.district,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join(', ') || null;
}

export function toSummaryPatient(patient: fhir.Patient): OutpatientSummaryPatient | null {
  if (!patient.id) return null;
  const name = formatDeceasedName(patient);
  if (!name) return null;
  const identifiers = (patient.identifier ?? []).flatMap((identifier) => {
    const value = identifier.value?.trim();
    return value ? [{ label: getIdentifierLabel(identifier), value }] : [];
  });
  return {
    uuid: patient.id,
    name,
    identifiers,
    birthDate: patient.birthDate ?? null,
    gender: patient.gender ?? null,
    address: formatPatientAddress(patient),
  };
}

function getVisitSummaryLabels(t: TFunction): OutpatientVisitSummaryPdfLabels {
  return {
    title: t('outpatientCareReport', 'Resumen de atención ambulatoria'),
    patient: t('patient', 'Paciente'),
    identifiers: t('identifiers', 'Identificadores'),
    birthDate: t('birthDate', 'Fecha de nacimiento'),
    gender: t('gender', 'Sexo'),
    visit: t('visit', 'Visita'),
    visitDate: t('visitDate', 'Fecha y hora de atención'),
    visitType: t('visitType', 'Tipo de visita'),
    location: t('location', 'Lugar de atención'),
    professional: t('responsibleHealthProfessional', 'Personal de salud responsable'),
    vitalSigns: t('vitalSigns', 'Signos vitales y antropometría'),
    bloodPressure: t('bloodPressure', 'Presión arterial'),
    temperature: t('temperature', 'Temperatura'),
    oxygenSaturation: t('oxygenSaturation', 'Saturación de oxígeno'),
    weight: t('weight', 'Peso'),
    height: t('height', 'Talla'),
    pulse: t('pulse', 'Pulso'),
    respiratoryRate: t('respiratoryRate', 'Frecuencia respiratoria'),
    bmi: t('bmi', 'IMC'),
    anamnesis: t('anamnesis', 'Anamnesis'),
    chiefComplaint: t('chiefComplaint', 'Motivo de consulta'),
    illnessDuration: t('illnessDuration', 'Tiempo de enfermedad'),
    onsetType: t('onsetType', 'Forma de inicio'),
    course: t('course', 'Curso'),
    currentIllness: t('currentIllness', 'Enfermedad actual'),
    biologicalFunctions: t('biologicalFunctions', 'Funciones biológicas'),
    appetite: t('appetite', 'Apetito'),
    thirst: t('thirst', 'Sed'),
    sleep: t('sleep', 'Sueño'),
    mood: t('mood', 'Estado de ánimo'),
    urine: t('urine', 'Orina'),
    bowelMovements: t('bowelMovements', 'Deposiciones'),
    soap: t('soapNotes', 'Evaluación clínica (SOAP)'),
    subjective: t('subjective', 'Subjetivo'),
    objective: t('objective', 'Objetivo'),
    assessment: t('assessment', 'Apreciación'),
    plan: t('plan', 'Plan'),
    physicalExam: t('physicalExam', 'Examen físico'),
    generalCondition: t('generalCondition', 'Estado general'),
    consciousnessStatus: t('consciousnessStatus', 'Conciencia y orientación'),
    skinAndAppendages: t('skinAndAppendages', 'Piel y faneras'),
    headAndNeck: t('headAndNeck', 'Cabeza y cuello'),
    respiratorySystem: t('respiratorySystem', 'Aparato respiratorio'),
    cardiovascularSystem: t('cardiovascularSystem', 'Aparato cardiovascular'),
    abdomenAndDigestiveSystem: t('abdomenAndDigestiveSystem', 'Abdomen'),
    genitourinarySystem: t('genitourinarySystem', 'Genito urinario'),
    musculoskeletalAndExtremities: t('musculoskeletalAndExtremities', 'Aparato locomotor y extremidades'),
    neurologicalExam: t('neurologicalExam', 'Neurológico'),
    otherObjectiveFindings: t('otherObjectiveFindings', 'Resumen regional y otros hallazgos objetivos'),
    diagnoses: t('diagnosesTitle', 'Diagnósticos'),
    diagnosisType: t('diagnosisType', 'Tipo'),
    presumptive: t('presumptive', 'Presuntivo'),
    definitive: t('definitive', 'Definitivo'),
    repeat: t('repeat', 'Repetitivo'),
    treatmentPlan: t('treatmentPlan', 'Plan de tratamiento'),
    therapeuticIndications: t('therapeuticIndications', 'Indicaciones terapéuticas'),
    procedures: t('procedures', 'Procedimientos'),
    referral: t('referral', 'Referencia'),
    nextAppointment: t('outpatientPatientInstructionsControlDate', 'Fecha de control indicada'),
    legacyLabOrders: t('auxiliaryExams', 'Exámenes auxiliares registrados'),
    legacyPrescriptions: t('prescriptions', 'Prescripciones registradas'),
    medications: t('medicationOrders', 'Órdenes de medicamentos'),
    medicationAsNeeded: t('outpatientMedicationAsNeeded', 'Según necesidad (PRN)'),
    medicationAsNeededReasonMissing: t(
      'outpatientMedicationAsNeededReasonMissing',
      'Según necesidad (PRN; motivo no registrado)',
    ),
    medicationIndication: t('outpatientMedicationIndication', 'Indicación'),
    medicationNumberOfRefills: t('outpatientMedicationNumberOfRefills', 'Número de renovaciones'),
    laboratoryOrders: t('laboratoryOrders', 'Órdenes de laboratorio'),
    otherOrders: t('otherOrders', 'Otras órdenes'),
    generatedAt: t('generatedAt', 'Generado'),
    page: t('page', 'Página'),
    disclaimer: t(
      'outpatientSummaryDisclaimer',
      'Resumen de una atención ambulatoria generado desde el registro clínico electrónico. No es un documento de alta hospitalaria ni reemplaza la firma o certificación institucional cuando corresponda.',
    ),
  };
}

function getPatientInstructionsLabels(
  t: TFunction,
  includesIndicatedFollowUpDate: boolean,
): OutpatientPatientInstructionsPdfLabels {
  const documentDisclaimer = t(
    'outpatientPatientInstructionsDisclaimer',
    'Hoja informativa generada desde el registro clínico electrónico de esta atención ambulatoria. Debe ser revisada, firmada y sellada por el profesional responsable antes de entregarla al paciente. No sustituye una receta médica o electrónica válida para dispensación.',
  );
  return {
    title: t('outpatientPatientInstructions', 'Indicaciones para el paciente'),
    patient: t('patient', 'Paciente'),
    identifiers: t('identifiers', 'Identificadores'),
    careDetails: t('outpatientPatientInstructionsCareDetails', 'Datos de la atención'),
    visitDate: t('visitDate', 'Fecha y hora de atención'),
    location: t('location', 'Lugar de atención'),
    professional: t('responsibleHealthProfessional', 'Personal de salud responsable'),
    instructions: t('outpatientPatientInstructionsSection', 'Indicaciones'),
    scheduledAppointment: t('outpatientPatientInstructionsScheduledAppointment', 'Próxima cita programada'),
    scheduledAppointmentDate: t('outpatientPatientInstructionsScheduledAppointmentDate', 'Fecha y hora'),
    scheduledAppointmentService: t('outpatientPatientInstructionsScheduledAppointmentService', 'Servicio'),
    scheduledAppointmentLocation: t('outpatientPatientInstructionsScheduledAppointmentLocation', 'Lugar'),
    scheduledAppointmentProfessional: t('outpatientPatientInstructionsScheduledAppointmentProfessional', 'Profesional'),
    indicatedFollowUpDate: t('outpatientPatientInstructionsControlDate', 'Fecha de control indicada'),
    therapeuticIndications: t('therapeuticIndications', 'Indicaciones terapéuticas'),
    medications: t('outpatientPatientMedications', 'Medicamentos indicados'),
    legacyPrescriptions: t('outpatientPatientMedications', 'Medicamentos indicados'),
    medicationAsNeeded: t('outpatientMedicationAsNeeded', 'Según necesidad (PRN)'),
    medicationAsNeededReasonMissing: t(
      'outpatientMedicationAsNeededReasonMissing',
      'Según necesidad (PRN; motivo no registrado)',
    ),
    medicationIndication: t('outpatientMedicationIndication', 'Indicación'),
    medicationNumberOfRefills: t('outpatientMedicationNumberOfRefills', 'Número de renovaciones'),
    signatureAndStamp: t(
      'outpatientPatientInstructionsSignatureAndStamp',
      'Firma, sello y N.° de colegiatura del profesional responsable',
    ),
    generatedAt: t('generatedAt', 'Generado'),
    page: t('page', 'Página'),
    followUpDateDisclaimer: includesIndicatedFollowUpDate
      ? `${t(
          'outpatientPatientInstructionsControlDateNotice',
          'La fecha de control indicada no confirma una cita programada. Confirme la reserva con el establecimiento de salud.',
        )} ${documentDisclaimer}`
      : documentDisclaimer,
  };
}

function getRecetaUnicaLabels(t: TFunction): OutpatientRecetaUnicaPdfLabels {
  return {
    title: t('recetaUnicaTitle', 'Receta Única Estandarizada'),
    pharmacyCopy: t('recetaUnicaPharmacyCopy', 'Ejemplar para farmacia'),
    patientCopy: t('recetaUnicaPatientCopy', 'Ejemplar para el paciente — Indicaciones'),
    prescriptionNumber: t('recetaUnicaNumber', 'Receta N.º'),
    issuedAt: t('recetaUnicaIssuedAt', 'Fecha de emisión'),
    validUntil: t('recetaUnicaValidUntil', 'Válida hasta'),
    patient: t('patient', 'Paciente'),
    identifiers: t('identifiers', 'Identificadores'),
    birthDate: t('birthDate', 'Fecha de nacimiento'),
    diagnoses: t('recetaUnicaDiagnoses', 'Diagnósticos (CIE-10)'),
    presumptive: t('presumptive', 'Presuntivo'),
    definitive: t('definitive', 'Definitivo'),
    repeat: t('repeat', 'Repetitivo'),
    medications: t('recetaUnicaMedications', 'Medicamentos prescritos'),
    visitDate: t('visitDate', 'Fecha y hora de atención'),
    location: t('location', 'Lugar de atención'),
    professional: t('responsibleProfessional', 'Personal de salud responsable'),
    collegiateNumber: t('collegiateNumber', 'N.º de colegiatura'),
    medicationAsNeeded: t('outpatientMedicationAsNeeded', 'Según necesidad (PRN)'),
    medicationAsNeededReasonMissing: t('outpatientMedicationAsNeededReasonMissing', 'Según necesidad (PRN; motivo no registrado)'),
    medicationIndication: t('outpatientMedicationIndication', 'Indicación'),
    medicationNumberOfRefills: t('outpatientMedicationNumberOfRefills', 'Número de renovaciones'),
    indicatedFollowUpDate: t('outpatientPatientInstructionsControlDate', 'Fecha de control indicada'),
    therapeuticIndications: t('therapeuticIndications', 'Indicaciones terapéuticas'),
    signatureAndStamp: t(
      'outpatientPatientInstructionsSignatureAndStamp',
      'Firma, sello y N.° de colegiatura del profesional responsable',
    ),
    validOnlySignedLegend: t(
      'recetaUnicaValidOnlySigned',
      'Válida únicamente con la firma y el sello manuscritos del profesional prescriptor.',
    ),
    generatedAt: t('generatedAt', 'Generado'),
    page: t('page', 'Página'),
    disclaimer: t(
      'recetaUnicaDisclaimer',
      'Documento numerado por el sistema del establecimiento; la emisión queda registrada en el servidor. No válido para sustancias controladas, que requieren recetario especial.',
    ),
  };
}

const OutpatientVisitSummaryDownload: React.FC<OutpatientVisitSummaryDownloadProps> = ({ patientUuid }) => {
  const { t, i18n } = useTranslation();
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const sessionLocationUuid = session?.sessionLocation?.uuid ?? null;
  const facilityIdentity = useOutpatientFacilityIdentity({
    sessionLocationUuid,
    fallbackLocationUuid: config.outpatientDocumentFacilityLocationUuid,
    phoneAttributeTypeUuid: config.outpatientDocumentFacilityPhoneAttributeTypeUuid,
    ipressCodeAttributeTypeUuid: config.outpatientDocumentFacilityIpressCodeAttributeTypeUuid,
    fallbackAddress: config.outpatientDocumentFacilityAddress,
    fallbackPhone: config.outpatientDocumentFacilityPhone,
    fallbackIpressCode: config.referralOriginRenaesCode,
  });
  const isWaitingForFacilityMetadata = facilityIdentity.isLoading;
  const facilityIdentityFingerprint = JSON.stringify([
    session?.sessionLocation?.display ?? null,
    facilityIdentity.facilityAddress,
    facilityIdentity.facilityPhone,
    facilityIdentity.facilityIpressCode,
  ]);
  const { patient, isLoading: isPatientLoading, error: patientError } = usePatient(patientUuid);
  const { requireAmbulatoryVisit, verifiedAmbulatoryVisitUuid } = useAmbulatoryVisitGuard({
    patientUuid,
    ambulatoryVisitTypeUuid: config.visitTypes.ambulatory,
  });
  const [generationTarget, setGenerationTarget] = useState<GenerationTarget | null>(null);
  const generationInProgressRef = useRef(false);
  const generationEpochRef = useRef(0);
  const activeGenerationAbortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const activePatientUuidRef = useRef(patientUuid);
  const activeVisitUuidRef = useRef(verifiedAmbulatoryVisitUuid);
  const activeSessionLocationUuidRef = useRef(sessionLocationUuid);
  const activeFacilityIdentityFingerprintRef = useRef(facilityIdentityFingerprint);

  useLayoutEffect(() => {
    activeGenerationAbortControllerRef.current?.abort();
    activeGenerationAbortControllerRef.current = null;
    activePatientUuidRef.current = patientUuid;
    activeVisitUuidRef.current = verifiedAmbulatoryVisitUuid;
    activeSessionLocationUuidRef.current = sessionLocationUuid;
    activeFacilityIdentityFingerprintRef.current = facilityIdentityFingerprint;
    generationEpochRef.current += 1;
    generationInProgressRef.current = false;
    setGenerationTarget(null);
  }, [facilityIdentityFingerprint, patientUuid, sessionLocationUuid, verifiedAmbulatoryVisitUuid]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      activeGenerationAbortControllerRef.current?.abort();
      activeGenerationAbortControllerRef.current = null;
      mountedRef.current = false;
      generationEpochRef.current += 1;
      generationInProgressRef.current = false;
    };
  }, []);

  const showError = useCallback((title: string, subtitle: string) => {
    showSnackbar({ isLowContrast: false, kind: 'error', title, subtitle });
  }, []);

  const getErrorTitle = useCallback(
    (target: GenerationTarget) =>
      target === 'patient-instructions'
        ? t('outpatientPatientInstructionsError', 'No se pudo generar el PDF de indicaciones')
        : target === 'receta-unica'
          ? t('recetaUnicaError', 'No se pudo emitir la Receta Única')
          : t('outpatientSummaryDownloadError', 'No se pudo descargar el resumen de atención'),
    [t],
  );

  const loadVerifiedSummary = useCallback(
    async (target: GenerationTarget): Promise<VerifiedOutpatientSummary | null> => {
      const visit = requireAmbulatoryVisit();
      if (!visit) return null;
      const errorTitle = getErrorTitle(target);
      if (isPatientLoading) {
        showError(
          errorTitle,
          t('outpatientSummaryPatientPending', 'Los datos del paciente todavía se están verificando.'),
        );
        return null;
      }
      if (patientError || !patient) {
        showError(errorTitle, t('outpatientSummaryPatientError', 'No se pudo verificar la identidad del paciente.'));
        return null;
      }

      const summaryPatient = toSummaryPatient(patient);
      if (!summaryPatient || summaryPatient.uuid.toLowerCase() !== patientUuid.toLowerCase()) {
        showError(
          errorTitle,
          t('outpatientSummaryPatientMismatch', 'La identidad del paciente no coincide con la visita.'),
        );
        return null;
      }

      const genderLabels: Record<string, string> = {
        female: t('female', 'Femenino'),
        male: t('male', 'Masculino'),
        other: t('other', 'Otro'),
        unknown: t('unknown', 'No especificado'),
      };
      summaryPatient.gender = genderLabels[summaryPatient.gender ?? ''] ?? summaryPatient.gender;

      const source = await fetchOutpatientVisitSummarySource(visit.uuid);
      const summary = buildOutpatientVisitSummary({
        source,
        expectedVisitUuid: visit.uuid,
        expectedPatientUuid: patientUuid,
        expectedVisitTypeUuid: config.visitTypes.ambulatory,
        patient: summaryPatient,
        facilityName: session?.sessionLocation?.display ?? t('healthFacility', 'Establecimiento de salud'),
        facilityAddress: facilityIdentity.facilityAddress,
        facilityPhone: facilityIdentity.facilityPhone,
        facilityIpressCode: facilityIdentity.facilityIpressCode,
        concepts: config.concepts,
      });
      return {
        linkedAppointmentUuids: getLinkedAppointmentUuids(source, config.appointmentVisitAttributeTypeUuid),
        summary,
      };
    },
    [
      config.appointmentVisitAttributeTypeUuid,
      config.concepts,
      config.visitTypes.ambulatory,
      facilityIdentity.facilityAddress,
      facilityIdentity.facilityIpressCode,
      facilityIdentity.facilityPhone,
      getErrorTitle,
      isPatientLoading,
      patient,
      patientError,
      patientUuid,
      requireAmbulatoryVisit,
      session?.sessionLocation?.display,
      showError,
      t,
    ],
  );

  const runWithSummary = useCallback(
    async (
      target: GenerationTarget,
      action: (
        summary: OutpatientVisitSummary,
        linkedAppointmentUuids: string[],
        isCurrent: IsGenerationCurrent,
        signal: AbortSignal,
      ) => Promise<void>,
    ) => {
      if (generationInProgressRef.current) return;
      activeGenerationAbortControllerRef.current?.abort();
      const operationPatientUuid = patientUuid;
      const operationVisitUuid = verifiedAmbulatoryVisitUuid;
      const operationSessionLocationUuid = sessionLocationUuid;
      const operationFacilityIdentityFingerprint = facilityIdentityFingerprint;
      const operationAbortController = new AbortController();
      const operationEpoch = generationEpochRef.current + 1;
      generationEpochRef.current = operationEpoch;
      activeGenerationAbortControllerRef.current = operationAbortController;
      const isCurrent = () =>
        mountedRef.current &&
        !operationAbortController.signal.aborted &&
        activePatientUuidRef.current === operationPatientUuid &&
        activeVisitUuidRef.current === operationVisitUuid &&
        activeSessionLocationUuidRef.current === operationSessionLocationUuid &&
        activeFacilityIdentityFingerprintRef.current === operationFacilityIdentityFingerprint &&
        generationEpochRef.current === operationEpoch;
      generationInProgressRef.current = true;
      setGenerationTarget(target);
      try {
        const verifiedSummary = await loadVerifiedSummary(target);
        if (verifiedSummary && isCurrent()) {
          await action(
            verifiedSummary.summary,
            verifiedSummary.linkedAppointmentUuids,
            isCurrent,
            operationAbortController.signal,
          );
        }
      } catch (error) {
        if (!isCurrent()) return;
        createErrorHandler()(error);
        const unsupportedCharacterMessage =
          error instanceof Error && error.name === 'OutpatientPdfUnsupportedCharacterError'
            ? t(
                'outpatientPdfUnsupportedCharacters',
                'El documento contiene caracteres que no se pueden representar con seguridad. Revise el texto registrado o contacte a soporte.',
              )
            : null;
        showError(
          getErrorTitle(target),
          unsupportedCharacterMessage ??
            (target === 'patient-instructions'
              ? t(
                  'outpatientPatientInstructionsGenerationError',
                  'No se pudo verificar o generar el PDF de indicaciones. Recargue e intente nuevamente.',
                )
              : t(
                  'outpatientSummaryGenerationError',
                  'No se pudo verificar o generar el resumen de esta atención. Recargue e intente nuevamente.',
                )),
        );
      } finally {
        if (isCurrent()) {
          generationInProgressRef.current = false;
          setGenerationTarget(null);
        }
      }
    },
    [
      facilityIdentityFingerprint,
      getErrorTitle,
      loadVerifiedSummary,
      patientUuid,
      sessionLocationUuid,
      showError,
      t,
      verifiedAmbulatoryVisitUuid,
    ],
  );

  const handleDownload = useCallback(() => {
    return runWithSummary('visit-summary', async (summary, _linkedAppointmentUuids, isCurrent) => {
      if (!summary.hasClinicalContent) {
        if (!isCurrent()) return;
        showError(
          getErrorTitle('visit-summary'),
          t(
            'outpatientSummaryNoClinicalData',
            'Esta atención todavía no tiene información clínica suficiente para generar el resumen.',
          ),
        );
        return;
      }

      const bytes = await createOutpatientVisitSummaryPdf(summary, getVisitSummaryLabels(t), i18n.language || 'es-PE');
      if (!isCurrent()) return;
      downloadOutpatientVisitSummaryPdf(
        bytes,
        createOutpatientVisitSummaryFileName(summary.visitUuid, summary.visitStart),
      );
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('outpatientSummaryDownloaded', 'Resumen descargado'),
        subtitle: t(
          'outpatientSummaryDownloadedSubtitle',
          'El resumen de esta atención se generó localmente en formato PDF.',
        ),
      });
    });
  }, [getErrorTitle, i18n.language, runWithSummary, showError, t]);

  const handlePrintPatientInstructions = useCallback(() => {
    return runWithSummary('patient-instructions', async (summary, linkedAppointmentUuids, isCurrent, signal) => {
      let scheduledAppointment = null;
      try {
        scheduledAppointment = await fetchNextScheduledAppointment(patientUuid, {
          excludedAppointmentUuids: linkedAppointmentUuids,
        });
      } catch (error) {
        if (!isCurrent()) return;
        createErrorHandler()(error);
        showSnackbar({
          isLowContrast: false,
          kind: 'warning',
          title: t('outpatientScheduledAppointmentUnavailable', 'No se pudo verificar la cita programada'),
          subtitle: t(
            'outpatientScheduledAppointmentUnavailableSubtitle',
            'La próxima cita no se incluirá en el PDF. Verifíquela en Agenda antes de entregar el documento.',
          ),
        });
      }

      if (!isCurrent()) return;
      scheduledAppointment = isUpcomingScheduledAppointment(scheduledAppointment) ? scheduledAppointment : null;

      if (!hasOutpatientPatientInstructions(summary, scheduledAppointment)) {
        showError(
          getErrorTitle('patient-instructions'),
          t(
            'outpatientPatientInstructionsNoData',
            'Registre una fecha de control, indicaciones terapéuticas o medicamentos antes de imprimir este documento.',
          ),
        );
        return;
      }

      const fileName = createOutpatientPatientInstructionsFileName(summary.visitUuid, summary.visitStart);
      let bytes = await createOutpatientPatientInstructionsPdf(
        summary,
        getPatientInstructionsLabels(t, Boolean(summary.treatment?.nextAppointment?.trim())),
        i18n.language || 'es-PE',
        scheduledAppointment,
      );
      if (!isCurrent()) return;
      if (scheduledAppointment && !isUpcomingScheduledAppointment(scheduledAppointment)) {
        scheduledAppointment = null;
        if (!hasOutpatientPatientInstructions(summary, null)) {
          showError(
            getErrorTitle('patient-instructions'),
            t(
              'outpatientPatientInstructionsNoData',
              'Registre una fecha de control, indicaciones terapéuticas o medicamentos antes de imprimir este documento.',
            ),
          );
          return;
        }
        bytes = await createOutpatientPatientInstructionsPdf(
          summary,
          getPatientInstructionsLabels(t, Boolean(summary.treatment?.nextAppointment?.trim())),
          i18n.language || 'es-PE',
          null,
        );
        if (!isCurrent()) return;
      }
      let outcome = await printPdfBytes(bytes, fileName, {
        signal,
        isContentCurrent: scheduledAppointment ? () => isUpcomingScheduledAppointment(scheduledAppointment) : undefined,
      });
      if (!isCurrent()) return;
      if (outcome === 'content-stale' && scheduledAppointment) {
        scheduledAppointment = null;
        if (!hasOutpatientPatientInstructions(summary, null)) {
          showError(
            getErrorTitle('patient-instructions'),
            t(
              'outpatientPatientInstructionsNoData',
              'Registre una fecha de control, indicaciones terapéuticas o medicamentos antes de imprimir este documento.',
            ),
          );
          return;
        }
        bytes = await createOutpatientPatientInstructionsPdf(
          summary,
          getPatientInstructionsLabels(t, Boolean(summary.treatment?.nextAppointment?.trim())),
          i18n.language || 'es-PE',
          null,
        );
        if (!isCurrent()) return;
        outcome = await printPdfBytes(bytes, fileName, { signal });
        if (!isCurrent()) return;
      }
      if (outcome === 'cancelled' || outcome === 'content-stale') return;
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('outpatientPatientInstructionsReady', 'Indicaciones listas'),
        subtitle:
          outcome === 'print-requested'
            ? t(
                'outpatientPatientInstructionsPrintOpened',
                'Se solicitó abrir el PDF de indicaciones en el diálogo de impresión.',
              )
            : t(
                'outpatientPatientInstructionsDownloaded',
                'No se pudo usar el visor de impresión integrado; se descargó el mismo PDF para imprimirlo.',
              ),
      });
    });
  }, [getErrorTitle, i18n.language, patientUuid, runWithSummary, showError, t]);

  // Un frontend nuevo puede convivir con una configuración desplegada que aún
  // no declara el bloque: sin fuente configurada la emisión queda apagada.
  const recetaUnicaConfig = config.recetaUnica ?? {
    identifierSourceUuid: '',
    validityDays: 3,
    collegiateNumberProviderAttributeTypeUuid: '',
  };
  const handlePrintRecetaUnica = useCallback(() => {
    return runWithSummary('receta-unica', async (summary, _linkedAppointmentUuids, isCurrent, signal) => {
      if (!hasOutpatientRecetaUnicaContent(summary)) {
        showError(
          getErrorTitle('receta-unica'),
          t('recetaUnicaNoMedications', 'Registre al menos un medicamento mediante órdenes antes de emitir la receta.'),
        );
        return;
      }

      // Numeración y fecha DEL SERVIDOR. Sin ellas no hay receta: se aborta y
      // queda disponible la hoja informativa. Nunca degradar a numeración
      // local: dos laptops sin red acuñarían duplicados.
      let emission: Awaited<ReturnType<typeof generateRecetaUnicaNumber>>;
      try {
        emission = await generateRecetaUnicaNumber(
          recetaUnicaConfig.identifierSourceUuid,
          `receta-unica visita:${summary.visitUuid} paciente:${patientUuid}`,
          recetaUnicaConfig.validityDays,
          signal,
        );
      } catch (error) {
        if (!isCurrent()) return;
        createErrorHandler()(error);
        showError(
          getErrorTitle('receta-unica'),
          t(
            'recetaUnicaNumberUnavailable',
            'El servidor no entregó la numeración. Sin correlativo auditado no se emite la Receta Única; entregue la hoja de indicaciones informativa.',
          ),
        );
        return;
      }
      if (!isCurrent()) return;

      // La colegiatura registrada es un mejor-esfuerzo: si falta o falla la
      // lectura, la línea queda para completarse a mano junto a la firma.
      let collegiateNumber: string | null = null;
      const providerUuid = session?.currentProvider?.uuid;
      if (providerUuid) {
        try {
          collegiateNumber = await fetchProviderCollegiateNumber(
            providerUuid,
            recetaUnicaConfig.collegiateNumberProviderAttributeTypeUuid,
            signal,
          );
        } catch {
          collegiateNumber = null;
        }
      }
      if (!isCurrent()) return;

      const bytes = await createOutpatientRecetaUnicaPdf(summary, getRecetaUnicaLabels(t), i18n.language || 'es-PE', {
        number: emission.number,
        issuedAt: emission.issuedAt,
        validUntil: emission.validUntil,
        collegiateNumber,
      });
      if (!isCurrent()) return;
      const outcome = await printPdfBytes(bytes, createOutpatientRecetaUnicaFileName(emission.number, summary.visitStart), {
        signal,
      });
      if (!isCurrent()) return;
      if (outcome === 'cancelled' || outcome === 'content-stale') return;
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('recetaUnicaReady', 'Receta Única emitida'),
        subtitle: t('recetaUnicaReadySubtitle', 'Receta N.º {{number}}. La emisión quedó registrada en el servidor.', {
          number: emission.number,
        }),
      });
    });
  }, [
    getErrorTitle,
    i18n.language,
    patientUuid,
    recetaUnicaConfig.collegiateNumberProviderAttributeTypeUuid,
    recetaUnicaConfig.identifierSourceUuid,
    recetaUnicaConfig.validityDays,
    runWithSummary,
    session?.currentProvider?.uuid,
    showError,
    t,
  ]);

  const printLabel = t('printOutpatientPatientInstructions', 'Imprimir indicaciones');
  const downloadLabel = t('downloadOutpatientCareReport', 'Descargar resumen de esta atención');
  const isGenerating = generationTarget !== null;
  const documentActionsDisabled = isGenerating || isWaitingForFacilityMetadata;

  return (
    <div
      className={styles.dashboardActions}
      role="group"
      aria-label={t('outpatientDocumentActions', 'Documentos de la atención ambulatoria')}
      aria-busy={documentActionsDisabled}
    >
      <Button
        kind="tertiary"
        size="sm"
        renderIcon={Printer}
        disabled={documentActionsDisabled}
        onClick={handlePrintPatientInstructions}
        aria-label={printLabel}
      >
        {generationTarget === 'patient-instructions'
          ? t('generatingOutpatientPatientInstructions', 'Generando indicaciones…')
          : printLabel}
      </Button>
      {recetaUnicaConfig.identifierSourceUuid ? (
        <Button
          kind="tertiary"
          size="sm"
          renderIcon={Printer}
          disabled={documentActionsDisabled}
          onClick={handlePrintRecetaUnica}
          aria-label={t('printRecetaUnica', 'Emitir Receta Única')}
        >
          {generationTarget === 'receta-unica'
            ? t('generatingRecetaUnica', 'Emitiendo receta…')
            : t('printRecetaUnica', 'Emitir Receta Única')}
        </Button>
      ) : null}
      <Button
        kind="ghost"
        size="sm"
        renderIcon={Download}
        disabled={documentActionsDisabled}
        onClick={handleDownload}
        aria-label={downloadLabel}
      >
        {generationTarget === 'visit-summary'
          ? t('generatingOutpatientCareReport', 'Generando resumen…')
          : downloadLabel}
      </Button>
    </div>
  );
};

export default OutpatientVisitSummaryDownload;
