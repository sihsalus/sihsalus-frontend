import { Button } from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { createErrorHandler, showSnackbar, useConfig, usePatient, useSession } from '@openmrs/esm-framework';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useAmbulatoryVisitGuard } from '../hooks';
import { formatDeceasedName } from '../utils/utils';
import {
  buildOutpatientVisitSummary,
  fetchOutpatientVisitSummarySource,
  type OutpatientSummaryPatient,
} from './outpatient-visit-summary.resource';
import {
  createOutpatientVisitSummaryFileName,
  createOutpatientVisitSummaryPdf,
  downloadOutpatientVisitSummaryPdf,
  type OutpatientVisitSummaryPdfLabels,
} from './outpatient-visit-summary-pdf';

interface OutpatientVisitSummaryDownloadProps {
  patientUuid: string;
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

const OutpatientVisitSummaryDownload: React.FC<OutpatientVisitSummaryDownloadProps> = ({ patientUuid }) => {
  const { t, i18n } = useTranslation();
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const { patient, isLoading: isPatientLoading, error: patientError } = usePatient(patientUuid);
  const { requireAmbulatoryVisit } = useAmbulatoryVisitGuard({
    patientUuid,
    ambulatoryVisitTypeUuid: config.visitTypes.ambulatory,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const generationInProgressRef = useRef(false);

  const showError = useCallback(
    (subtitle: string) => {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('outpatientSummaryDownloadError', 'No se pudo descargar el resumen de atención'),
        subtitle,
      });
    },
    [t],
  );

  const handleDownload = useCallback(async () => {
    if (generationInProgressRef.current) return;
    const visit = requireAmbulatoryVisit();
    if (!visit) return;
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

    generationInProgressRef.current = true;
    setIsGenerating(true);
    try {
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
      if (!summary.hasClinicalContent) {
        showError(
          t(
            'outpatientSummaryNoClinicalData',
            'Esta atención todavía no tiene información clínica suficiente para generar el resumen.',
          ),
        );
        return;
      }

      const labels: OutpatientVisitSummaryPdfLabels = {
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
        musculoskeletalAndExtremities: t(
          'musculoskeletalAndExtremities',
          'Aparato locomotor y extremidades',
        ),
        neurologicalExam: t('neurologicalExam', 'Neurológico'),
        otherObjectiveFindings: t(
          'otherObjectiveFindings',
          'Resumen regional y otros hallazgos objetivos',
        ),
        diagnoses: t('diagnosesTitle', 'Diagnósticos'),
        diagnosisType: t('diagnosisType', 'Tipo'),
        presumptive: t('presumptive', 'Presuntivo'),
        definitive: t('definitive', 'Definitivo'),
        repeat: t('repeat', 'Repetitivo'),
        treatmentPlan: t('treatmentPlan', 'Plan de tratamiento'),
        therapeuticIndications: t('therapeuticIndications', 'Indicaciones terapéuticas'),
        procedures: t('procedures', 'Procedimientos'),
        referral: t('referral', 'Referencia'),
        nextAppointment: t('nextAppointment', 'Próxima cita'),
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
      const bytes = await createOutpatientVisitSummaryPdf(summary, labels, i18n.language || 'es-PE');
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
    } catch (error) {
      createErrorHandler()(error);
      showError(
        t(
          'outpatientSummaryGenerationError',
          'No se pudo verificar o generar el resumen de esta atención. Recargue e intente nuevamente.',
        ),
      );
    } finally {
      generationInProgressRef.current = false;
      setIsGenerating(false);
    }
  }, [
    config.concepts,
    config.visitTypes.ambulatory,
    i18n.language,
    isPatientLoading,
    patient,
    patientError,
    patientUuid,
    requireAmbulatoryVisit,
    session?.sessionLocation?.display,
    showError,
    t,
  ]);

  return (
    <Button
      kind="ghost"
      size="sm"
      renderIcon={Download}
      disabled={isGenerating}
      onClick={handleDownload}
      aria-label={t('downloadOutpatientCareReport', 'Descargar resumen de esta atención')}
    >
      {isGenerating
        ? t('generatingOutpatientCareReport', 'Generando resumen…')
        : t('downloadOutpatientCareReport', 'Descargar resumen de esta atención')}
    </Button>
  );
};

export default OutpatientVisitSummaryDownload;
