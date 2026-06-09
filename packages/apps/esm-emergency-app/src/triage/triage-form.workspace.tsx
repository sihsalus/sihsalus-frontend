import { Button, ButtonSet, Dropdown, Form, InlineNotification, NumberInput, TextArea, TextInput } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { type DefaultWorkspaceProps, showSnackbar, useConfig } from '@openmrs/esm-framework';
import {
  parsePlainDecimalInput,
  preventScientificNotationKey,
  preventScientificNotationPaste,
} from '@sihsalus/esm-sihsalus-shared';
import React, { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import type { Config } from '../config-schema';
import PrioritySelector from '../emergency-workflow/components/priority-selector.component';
import { useConceptReferenceRanges } from '../hooks/useConceptReferenceRanges';
import { useEmergencyConfig, usePriorityConfig } from '../hooks/usePriorityConfig';
import {
  createTriageEncounter,
  type EmergencyQueueEntry,
  transitionToAttentionQueue,
} from '../resources/emergency.resource';
import {
  type TriageFormData,
  triageFormSchema,
  type VitalFieldName,
  validateVitalsAgainstRanges,
} from './triage-form.validation';
import styles from './triage-form.workspace.scss';
import VitalInput from './vital-input.component';

interface TriageFormWorkspaceProps extends DefaultWorkspaceProps {
  queueEntry: EmergencyQueueEntry;
}

/** Maps vital form fields to their concept UUID keys in config */
const VITAL_FIELDS: Array<{ field: VitalFieldName; conceptKey: string }> = [
  { field: 'temperature', conceptKey: 'temperatureUuid' },
  { field: 'heartRate', conceptKey: 'heartRateUuid' },
  { field: 'respiratoryRate', conceptKey: 'respiratoryRateUuid' },
  { field: 'oxygenSaturation', conceptKey: 'oxygenSaturationUuid' },
  { field: 'systolicBp', conceptKey: 'systolicBpUuid' },
  { field: 'diastolicBp', conceptKey: 'diastolicBpUuid' },
];

const TriageFormWorkspace: React.FC<TriageFormWorkspaceProps> = ({ closeWorkspace, queueEntry }) => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const config = useConfig<Config>();
  const { triageEncounter, emergencyAttentionQueueUuid, queueStatuses, emergencyLocationUuid } = useEmergencyConfig();
  const { getSortWeight } = usePriorityConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const consciousnessLevelItems = useMemo(
    () => [
      { id: 'alert', text: t('avpuAlert', 'Alerta') },
      { id: 'verbal', text: t('avpuVerbal', 'Respuesta verbal') },
      { id: 'pain', text: t('avpuPain', 'Respuesta al dolor') },
      { id: 'unresponsive', text: t('avpuUnresponsive', 'No responde') },
    ],
    [t],
  );

  const patientName = queueEntry.patient.person?.display || queueEntry.patient.display;
  const gender = queueEntry.patient.person?.gender || '';
  const age = queueEntry.patient.person?.age;
  const patientUuid = queueEntry.patient.uuid;
  const visitUuid = queueEntry.visit?.uuid;

  const conceptMap = triageEncounter.vitalSignsConcepts;

  const fieldToConceptUuid = useMemo<Record<VitalFieldName, string>>(
    () =>
      Object.fromEntries(
        VITAL_FIELDS.map(({ field, conceptKey }) => [field, conceptMap[conceptKey as keyof typeof conceptMap]]),
      ) as Record<VitalFieldName, string>,
    [conceptMap],
  );

  const conceptUuids = useMemo(() => Object.values(fieldToConceptUuid), [fieldToConceptUuid]);
  const { referenceRanges } = useConceptReferenceRanges(patientUuid, conceptUuids);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TriageFormData>({
    resolver: zodResolver(triageFormSchema),
    defaultValues: {
      // Anamnesis
      illnessDuration: '',
      onsetType: '',
      course: '',
      anamnesis: '',
      // Signos vitales
      temperature: undefined,
      heartRate: undefined,
      respiratoryRate: undefined,
      systolicBp: undefined,
      diastolicBp: undefined,
      oxygenSaturation: undefined,
      consciousnessLevel: 'alert',
      // Antropometría
      weight: undefined,
      height: undefined,
      // Examen clínico
      clinicalExam: '',
      // Prioridad — default Prioridad I
      priorityUuid: config.concepts.priorityIConceptUuid,
    },
  });

  const onSubmit = useCallback(
    async (data: TriageFormData) => {
      if (!visitUuid) {
        showSnackbar({
          title: t('error', 'Error'),
          kind: 'error',
          subtitle: t('noVisitFound', 'No se encontró una visita activa para este paciente'),
        });
        return;
      }

      setIsSubmitting(true);

      try {
        // Validate against patient-specific absolute ranges
        if (referenceRanges) {
          const rangeErrors = validateVitalsAgainstRanges(data, fieldToConceptUuid, referenceRanges, t);

          if (rangeErrors.length > 0) {
            for (const rangeError of rangeErrors) {
              setError(rangeError.field, { message: rangeError.message });
            }
            showSnackbar({
              title: t('rangeValidationWarning', 'Valores fuera de rango'),
              kind: 'warning',
              subtitle: t(
                'rangeValidationWarningDetail',
                'Algunos valores están fuera del rango permitido para este paciente. Revise los campos marcados.',
              ),
            });
            setIsSubmitting(false);
            return;
          }
        }

        // Build observations
        const observations: Array<{ concept: string; value: string | number }> = [];

        // Vital signs
        for (const { field, conceptKey } of VITAL_FIELDS) {
          const value = data[field];
          if (value != null) {
            observations.push({ concept: conceptMap[conceptKey as keyof typeof conceptMap], value });
          }
        }

        if (data.consciousnessLevel) {
          const consciousnessText =
            consciousnessLevelItems.find((item) => item.id === data.consciousnessLevel)?.text ||
            data.consciousnessLevel;
          observations.push({ concept: conceptMap.consciousnessLevelUuid, value: consciousnessText });
        }

        // Antropometría
        if (data.weight != null) {
          observations.push({ concept: conceptMap.weightUuid, value: data.weight });
        }
        if (data.height != null) {
          observations.push({ concept: conceptMap.heightUuid, value: data.height });
        }

        // Anamnesis text fields
        if (data.illnessDuration) {
          observations.push({ concept: conceptMap.illnessDurationUuid, value: data.illnessDuration });
        }
        if (data.onsetType) {
          observations.push({ concept: conceptMap.onsetTypeUuid, value: data.onsetType });
        }
        if (data.course) {
          observations.push({ concept: conceptMap.courseUuid, value: data.course });
        }
        if (data.anamnesis) {
          observations.push({ concept: conceptMap.anamnesisUuid, value: data.anamnesis });
        }

        // Examen clínico
        if (data.clinicalExam) {
          observations.push({ concept: conceptMap.clinicalExamUuid, value: data.clinicalExam });
        }

        await createTriageEncounter(
          patientUuid,
          visitUuid,
          emergencyLocationUuid,
          triageEncounter.encounterTypeUuid,
          observations,
        );

        const sortWeight = getSortWeight(data.priorityUuid) ?? 4;
        await transitionToAttentionQueue(
          queueEntry.uuid,
          patientUuid,
          visitUuid,
          data.priorityUuid,
          emergencyAttentionQueueUuid,
          queueStatuses.waiting,
          sortWeight,
        );

        mutate((key) => typeof key === 'string' && key.includes('/queue-entry'));

        showSnackbar({
          isLowContrast: true,
          title: t('triageCompleted', 'Triaje completado'),
          kind: 'success',
          subtitle: t('triageCompletedSuccessfully', 'El paciente ha sido triado y enviado a la cola de atención'),
        });

        closeWorkspace();
      } catch (error: unknown) {
        showSnackbar({
          title: t('triageError', 'Error en el triaje'),
          kind: 'error',
          subtitle:
            error instanceof Error ? error.message : t('triageErrorGeneric', 'Ocurrió un error al completar el triaje'),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      visitUuid,
      patientUuid,
      queueEntry.uuid,
      conceptMap,
      consciousnessLevelItems,
      fieldToConceptUuid,
      referenceRanges,
      triageEncounter.encounterTypeUuid,
      emergencyLocationUuid,
      emergencyAttentionQueueUuid,
      queueStatuses.waiting,
      getSortWeight,
      setError,
      mutate,
      closeWorkspace,
      t,
    ],
  );

  const vitalLabels: Record<VitalFieldName, string> = {
    temperature: t('temperature', 'Temperatura (°C)'),
    heartRate: t('heartRate', 'Frecuencia cardíaca (lpm)'),
    respiratoryRate: t('respiratoryRate', 'Frecuencia respiratoria (rpm)'),
    oxygenSaturation: t('oxygenSaturation', 'Saturación O₂ (%)'),
    systolicBp: t('systolicBp', 'Presión sistólica (mmHg)'),
    diastolicBp: t('diastolicBp', 'Presión diastólica (mmHg)'),
  };

  return (
    <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.formContent}>
        <div className={styles.patientInfo}>
          <p className={styles.patientName}>{patientName}</p>
          <div className={styles.patientDetails}>
            <span>{gender === 'M' ? t('male', 'Masculino') : t('female', 'Femenino')}</span>
            {age != null && <span>{t('ageYears', '{{age}} años', { age })}</span>}
          </div>
        </div>

        {/* Sección: Anamnesis */}
        <h4 className={styles.sectionTitle}>{t('anamnesis', 'Anamnesis')}</h4>
        <div className={styles.vitalsGrid}>
          <Controller
            name="illnessDuration"
            control={control}
            render={({ field }) => (
              <TextInput
                id="illnessDuration"
                labelText={t('illnessDuration', 'T/E (Tiempo de enfermedad)')}
                placeholder={t('illnessDurationPlaceholder', 'Ej: 6 horas, 3 días')}
                value={field.value || ''}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />

          <Controller
            name="onsetType"
            control={control}
            render={({ field }) => (
              <TextInput
                id="onsetType"
                labelText={t('onsetType', 'F/I (Forma de inicio)')}
                placeholder={t('onsetTypePlaceholder', 'Ej: Súbito, Brusco, Insidioso')}
                value={field.value || ''}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />

          <Controller
            name="course"
            control={control}
            render={({ field }) => (
              <TextInput
                id="course"
                labelText={t('course', 'Curso')}
                placeholder={t('coursePlaceholder', 'Ej: Progresivo, Estacionario')}
                value={field.value || ''}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
        </div>

        <div className={styles.fullWidth}>
          <Controller
            name="anamnesis"
            control={control}
            render={({ field }) => (
              <TextArea
                id="anamnesis"
                labelText={t('anamnesisDetail', 'Relato de la enfermedad')}
                placeholder={t('anamnesisPlaceholder', 'Describa el motivo de consulta y relato cronológico...')}
                value={field.value || ''}
                onChange={(e) => field.onChange(e.target.value)}
                rows={4}
              />
            )}
          />
        </div>

        {/* Sección: Examen Clínico — Signos Vitales */}
        <h4 className={styles.sectionTitle}>{t('vitalSigns', 'Signos vitales')}</h4>
        <div className={styles.vitalsGrid}>
          {VITAL_FIELDS.map(({ field }) => (
            <VitalInput
              key={field}
              fieldName={field}
              label={vitalLabels[field]}
              control={control}
              errors={errors}
              referenceRange={referenceRanges?.[fieldToConceptUuid[field]]}
              step={field === 'temperature' ? 0.1 : undefined}
            />
          ))}

          <div className={styles.fullWidth}>
            <Controller
              name="consciousnessLevel"
              control={control}
              render={({ field }) => (
                <Dropdown
                  id="consciousnessLevel"
                  label={t('selectConsciousnessLevel', 'Seleccione nivel')}
                  titleText={t('consciousnessLevel', 'Nivel de conciencia (AVPU)')}
                  items={consciousnessLevelItems}
                  itemToString={(item) => item?.text || ''}
                  selectedItem={consciousnessLevelItems.find((item) => item.id === field.value) || null}
                  onChange={({ selectedItem }) => field.onChange(selectedItem?.id)}
                  invalid={!!errors.consciousnessLevel}
                  invalidText={errors.consciousnessLevel?.message}
                />
              )}
            />
          </div>
        </div>

        {/* Sección: Antropometría */}
        <h4 className={styles.sectionTitle}>{t('anthropometry', 'Antropometría')}</h4>
        <div className={styles.vitalsGrid}>
          <Controller
            name="weight"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="weight"
                label={t('weight', 'Peso (kg)')}
                min={0}
                max={250}
                step={0.1}
                type="number"
                allowEmpty
                disableWheel
                value={field.value ?? ''}
                onChange={(_e: unknown, { value: val }: { value: string | number }) => {
                  const parsedValue = val === '' ? undefined : parsePlainDecimalInput(val);
                  if (val === '' || parsedValue !== undefined) {
                    field.onChange(parsedValue);
                  }
                }}
                onKeyDown={preventScientificNotationKey}
                onPaste={preventScientificNotationPaste}
                invalid={!!errors.weight}
                invalidText={errors.weight?.message}
                hideSteppers
              />
            )}
          />

          <Controller
            name="height"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="height"
                label={t('height', 'Talla (cm)')}
                min={10}
                max={272}
                type="number"
                allowEmpty
                disableWheel
                value={field.value ?? ''}
                onChange={(_e: unknown, { value: val }: { value: string | number }) => {
                  const parsedValue = val === '' ? undefined : parsePlainDecimalInput(val);
                  if (val === '' || parsedValue !== undefined) {
                    field.onChange(parsedValue);
                  }
                }}
                onKeyDown={preventScientificNotationKey}
                onPaste={preventScientificNotationPaste}
                invalid={!!errors.height}
                invalidText={errors.height?.message}
                hideSteppers
              />
            )}
          />
        </div>

        {/* Sección: Examen Clínico texto libre */}
        <div className={styles.fullWidth}>
          <Controller
            name="clinicalExam"
            control={control}
            render={({ field }) => (
              <TextArea
                id="clinicalExam"
                labelText={t('clinicalExam', 'Examen clínico')}
                placeholder={t('clinicalExamPlaceholder', 'Hallazgos del examen clínico...')}
                value={field.value || ''}
                onChange={(e) => field.onChange(e.target.value)}
                rows={3}
              />
            )}
          />
        </div>

        {/* Sección: Prioridad */}
        <div className={styles.prioritySection}>
          <Controller
            name="priorityUuid"
            control={control}
            render={({ field }) => (
              <PrioritySelector selectedPriorityUuid={field.value} onChange={(uuid) => field.onChange(uuid)} />
            )}
          />
          {errors.priorityUuid && (
            <InlineNotification
              className={styles.errorNotification}
              kind="error"
              lowContrast
              hideCloseButton
              subtitle={errors.priorityUuid.message}
            />
          )}
        </div>
      </div>

      <ButtonSet className={styles.buttonSet}>
        <Button kind="secondary" onClick={() => closeWorkspace()} disabled={isSubmitting}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button kind="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('submittingTriage', 'Completando triaje...') : t('completeTriage', 'Completar triaje')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default TriageFormWorkspace;
