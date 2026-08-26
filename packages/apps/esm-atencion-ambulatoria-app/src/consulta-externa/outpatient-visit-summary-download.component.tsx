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
import { fetchNextScheduledAppointment, isUpcomingScheduledAppointment } from './outpatient-next-appointment.resource';
import { printPdfBytes } from './outpatient-pdf-print';
import {
  buildOutpatientVisitSummary,
  fetchOutpatientVisitSummarySource,
  getLinkedAppointmentUuids,
  type OutpatientSummaryPatient,
  type OutpatientVisitSummary,
} from './outpatient-visit-summary.resource';
import {
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

type GenerationTarget = 'patient-instructions' | 'visit-summary';
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

function toSummaryPatient(patient: fhir.Patient): OutpatientSummaryPatient | null {
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
    'Documento generado desde el registro clínico electrónico de esta atención ambulatoria. Siga las indicaciones del personal de salud y consulte al establecimiento si tiene dudas.',
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
    medications: t('outpatientPatientPrescription', 'Receta'),
    legacyPrescriptions: t('outpatientPatientPrescription', 'Receta'),
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

const OutpatientVisitSummaryDownload: React.FC<OutpatientVisitSummaryDownloadProps> = ({ patientUuid }) => {
  const { t, i18n } = useTranslation();
  const config = useConfig<ConfigObject>();
  const session = useSession();
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

  useLayoutEffect(() => {
    activeGenerationAbortControllerRef.current?.abort();
    activeGenerationAbortControllerRef.current = null;
    activePatientUuidRef.current = patientUuid;
    activeVisitUuidRef.current = verifiedAmbulatoryVisitUuid;
    generationEpochRef.current += 1;
    generationInProgressRef.current = false;
    setGenerationTarget(null);
  }, [patientUuid, verifiedAmbulatoryVisitUuid]);

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
      const operationAbortController = new AbortController();
      const operationEpoch = generationEpochRef.current + 1;
      generationEpochRef.current = operationEpoch;
      activeGenerationAbortControllerRef.current = operationAbortController;
      const isCurrent = () =>
        mountedRef.current &&
        !operationAbortController.signal.aborted &&
        activePatientUuidRef.current === operationPatientUuid &&
        activeVisitUuidRef.current === operationVisitUuid &&
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
    [getErrorTitle, loadVerifiedSummary, patientUuid, showError, t, verifiedAmbulatoryVisitUuid],
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
            'Registre una fecha de control, indicaciones terapéuticas o una receta antes de imprimir este documento.',
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
              'Registre una fecha de control, indicaciones terapéuticas o una receta antes de imprimir este documento.',
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
              'Registre una fecha de control, indicaciones terapéuticas o una receta antes de imprimir este documento.',
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

  const printLabel = t('printOutpatientPatientInstructions', 'Imprimir indicaciones');
  const downloadLabel = t('downloadOutpatientCareReport', 'Descargar resumen de esta atención');
  const isGenerating = generationTarget !== null;

  return (
    <div
      className={styles.dashboardActions}
      role="group"
      aria-label={t('outpatientDocumentActions', 'Documentos de la atención ambulatoria')}
      aria-busy={isGenerating}
    >
      <Button
        kind="tertiary"
        size="sm"
        renderIcon={Printer}
        disabled={isGenerating}
        onClick={handlePrintPatientInstructions}
        aria-label={printLabel}
      >
        {generationTarget === 'patient-instructions'
          ? t('generatingOutpatientPatientInstructions', 'Generando indicaciones…')
          : printLabel}
      </Button>
      <Button
        kind="ghost"
        size="sm"
        renderIcon={Download}
        disabled={isGenerating}
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
