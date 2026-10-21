import { Button, ButtonSet, Form, InlineNotification, Select, SelectItem, TextArea, TimePicker } from '@carbon/react';
import {
  OpenmrsDatePicker,
  showSnackbar,
  useConfig,
  useLayoutType,
  useSession,
  useVisit,
} from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import dayjs from 'dayjs';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import type { ConfigObject } from '../../../config-schema';
import { credImmunizationEditPrivilege } from '../../../constants';
import type { DefaultPatientWorkspaceProps } from '../../../types';

import { refreshAdverseReactions, saveAdverseReaction } from './adverse-reaction.resource';
import styles from './adverse-reaction-form.scss';

interface AdverseReaction {
  vaccineName: string;
  reactionDescription: string;
  severity: 'mild' | 'moderate' | 'severe' | '';
  reportDate: Date | null;
  reportTime: string;
}

const VACCINE_OPTIONS = [
  'HiB RN',
  'BCG',
  'Pentavalente (DPT, HB, Hib)',
  'Polio',
  'Rotavirus',
  'Neumococo',
  'Influenza pediátrica',
  'SPR',
  'Varicela',
];

const AdverseReactionFormWorkspace: React.FC<DefaultPatientWorkspaceProps> = ({
  closeWorkspace,
  patientUuid: patientUuidProp,
  workspaceProps,
}) => {
  const { t } = useTranslation('@sihsalus/esm-cred-app');
  const config = useConfig<ConfigObject>();
  const isTablet = useLayoutType() === 'tablet';
  const patientUuid = patientUuidProp ?? workspaceProps?.patientUuid;
  const { activeVisit, currentVisit } = useVisit(patientUuid);
  const visit = currentVisit ?? activeVisit;
  const locationUuid = visit?.location?.uuid;
  const session = useSession();
  const providerUuid = session?.authenticated ? session.currentProvider?.uuid : undefined;
  const [formData, setFormData] = useState<AdverseReaction>({
    vaccineName: '',
    reactionDescription: '',
    severity: '',
    reportDate: null,
    reportTime: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const submitting = useRef(false);
  const { mutate } = useSWRConfig();

  const handleInputChange = useCallback((field: keyof AdverseReaction, value: string | boolean | Date | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  const validateForm = useCallback((): boolean => {
    if (!formData.vaccineName) {
      setError(t('vaccineRequired', 'Debe seleccionar una vacuna'));
      return false;
    }
    if (!formData.reactionDescription.trim()) {
      setError(t('descriptionRequired', 'Debe ingresar una descripción de la reacción'));
      return false;
    }
    if (!formData.severity) {
      setError(t('severityRequired', 'Debe seleccionar la severidad'));
      return false;
    }
    if (!formData.reportDate || !Number.isFinite(formData.reportDate.getTime())) {
      setError(t('esaviReportDateRequired', 'Debe seleccionar la fecha del reporte'));
      return false;
    }
    const reportDatetime = getReportDatetime(formData.reportDate, formData.reportTime);
    if (!reportDatetime) {
      setError(t('esaviReportTimeRequired', 'Ingrese la hora del reporte en formato de 24 horas (HH:mm).'));
      return false;
    }
    if (!patientUuid || !locationUuid || !visit?.uuid || visit.stopDatetime || visit.patient?.uuid !== patientUuid) {
      setError(t('missingPatientOrLocation', 'Se requiere una visita activa con una UPSS asistencial'));
      return false;
    }
    const visitStart = Date.parse(visit.startDatetime);
    if (
      !Number.isFinite(visitStart) ||
      reportDatetime.getTime() < visitStart ||
      reportDatetime.getTime() > Date.now()
    ) {
      setError(
        t(
          'esaviReportOutsideVisit',
          'La fecha y hora del reporte debe estar dentro de la visita abierta y no puede ser futura.',
        ),
      );
      return false;
    }
    if (!providerUuid) {
      setError(t('esaviProviderRequired', 'Your session must be linked to a clinical provider to record the event.'));
      return false;
    }
    return true;
  }, [formData, locationUuid, patientUuid, providerUuid, visit, t]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (
        submitting.current ||
        isSaved ||
        !validateForm() ||
        !patientUuid ||
        !locationUuid ||
        !visit?.uuid ||
        !providerUuid
      ) {
        return;
      }

      const reportDatetime = getReportDatetime(formData.reportDate, formData.reportTime);
      if (!reportDatetime) return;

      setIsSubmitting(true);
      submitting.current = true;
      let saved = false;
      try {
        await saveAdverseReaction({
          patientUuid,
          locationUuid,
          visitUuid: visit.uuid,
          providerUuid,
          vaccineName: formData.vaccineName,
          reactionDescription: formData.reactionDescription,
          severity: formData.severity as Exclude<AdverseReaction['severity'], ''>,
          reportDatetime,
          config,
        });

        saved = true;
        setIsSaved(true);
        let refreshed = true;
        try {
          await refreshAdverseReactions(patientUuid, config, mutate);
        } catch {
          refreshed = false;
        }

        showSnackbar({
          kind: refreshed ? 'success' : 'warning',
          title: t('reactionSaved', 'Reacción registrada'),
          subtitle: refreshed
            ? t('reactionSavedSubtitle', 'La reacción adversa ha sido registrada exitosamente')
            : t(
                'reactionSavedRefreshFailed',
                'The reaction was saved. Reload the table to see it; do not register it again.',
              ),
          isLowContrast: true,
        });
        await closeWorkspace({ discardUnsavedChanges: true });
      } catch {
        if (saved) return;
        showSnackbar({
          kind: 'error',
          title: t('reactionSaveError', 'Error al registrar reacción'),
          subtitle: t(
            'reactionSaveUnconfirmed',
            'The adverse reaction could not be confirmed as saved. Review the history before trying again.',
          ),
          isLowContrast: false,
        });
      } finally {
        setIsSubmitting(false);
        submitting.current = false;
      }
    },
    [
      closeWorkspace,
      config,
      formData,
      isSaved,
      locationUuid,
      mutate,
      patientUuid,
      providerUuid,
      visit,
      validateForm,
      t,
    ],
  );

  return (
    <RequirePrivilege privilege={credImmunizationEditPrivilege}>
      <Form className={styles.adverseReactionForm} onSubmit={handleSubmit} noValidate>
        <div style={{ padding: '1rem' }}>
          <p>
            {t('esaviClinicalRecordHelp', 'This clinical record does not replace official adverse event notification.')}
          </p>
          <p>{t('requiredFieldsHint', 'Fields marked with * are required.')}</p>
          {error && (
            <InlineNotification
              kind="error"
              title={t('validationError', 'Error de validación')}
              subtitle={error}
              lowContrast
              className={styles.errorNotification}
            />
          )}

          <Select
            id="vaccine-select"
            labelText={`${t('vaccine', 'Vacuna')} *`}
            required
            value={formData.vaccineName}
            onChange={(e) => handleInputChange('vaccineName', e.target.value)}
            className={styles.formField}
          >
            <SelectItem text={t('selectVaccine', 'Seleccione una vacuna')} value="" />
            {VACCINE_OPTIONS.map((vaccine) => (
              <SelectItem key={vaccine} text={vaccine} value={vaccine} />
            ))}
          </Select>

          <TextArea
            id="reaction-description"
            labelText={`${t('reactionDescription', 'Descripción de la reacción')} *`}
            required
            value={formData.reactionDescription}
            onChange={(e) => handleInputChange('reactionDescription', e.target.value)}
            helperText={t(
              'esaviNarrativeTimingHelp',
              'Indique en la descripción cuándo inició el evento y la cronología de los síntomas. La fecha del reporte se registra por separado.',
            )}
            rows={4}
            placeholder={t('reactionPlaceholder', 'Describa los síntomas observados...')}
            className={styles.formField}
          />

          <Select
            id="severity-select"
            labelText={`${t('severity', 'Severidad')} *`}
            required
            value={formData.severity}
            onChange={(e) => handleInputChange('severity', e.target.value)}
            className={styles.formField}
          >
            <SelectItem text={t('selectSeverity', 'Seleccione severidad')} value="" />
            <SelectItem text={t('mild', 'Leve')} value="mild" />
            <SelectItem text={t('moderate', 'Moderada')} value="moderate" />
            <SelectItem text={t('severe', 'Severa')} value="severe" />
          </Select>

          <div className={styles.formField}>
            <OpenmrsDatePicker
              id="report-date"
              labelText={`${t('esaviReportDate', 'Fecha del reporte')} *`}
              isRequired
              minDate={visit?.startDatetime ? dayjs(visit.startDatetime).startOf('day') : undefined}
              maxDate={new Date()}
              value={formData.reportDate}
              onChange={(date) => handleInputChange('reportDate', date)}
            />
            <TimePicker
              id="report-time"
              labelText={`${t('esaviReportTime', 'Hora del reporte (24 horas)')} *`}
              value={formData.reportTime}
              placeholder="HH:mm"
              pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
              onChange={(event) => handleInputChange('reportTime', event.target.value)}
              aria-required={true}
            />
          </div>
        </div>

        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <Button kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button kind="primary" type="submit" disabled={isSubmitting || isSaved}>
            {t('registerReaction', 'Registrar Reacción')}
          </Button>
        </ButtonSet>
      </Form>
    </RequirePrivilege>
  );
};

export default AdverseReactionFormWorkspace;

function getReportDatetime(date: Date | null, time: string): Date | null {
  if (!date || !Number.isFinite(date.getTime()) || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
