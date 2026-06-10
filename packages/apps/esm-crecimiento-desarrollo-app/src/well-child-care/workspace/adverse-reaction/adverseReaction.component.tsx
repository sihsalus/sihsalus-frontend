import { Button, ButtonSet, Form, InlineNotification, Select, SelectItem, TextArea } from '@carbon/react';
import { OpenmrsDatePicker, showSnackbar, useConfig, useLayoutType, useSession } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { credImmunizationEditPrivilege } from '../../../constants';
import type { DefaultPatientWorkspaceProps } from '../../../types';

import { saveAdverseReaction } from './adverse-reaction.resource';
import styles from './adverse-reaction-form.scss';

interface AdverseReaction {
  vaccineName: string;
  reactionDescription: string;
  severity: 'mild' | 'moderate' | 'severe' | '';
  occurrenceDate: Date | null;
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
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const isTablet = useLayoutType() === 'tablet';
  const patientUuid = patientUuidProp ?? workspaceProps?.patientUuid;
  const locationUuid = session?.sessionLocation?.uuid;
  const [formData, setFormData] = useState<AdverseReaction>({
    vaccineName: '',
    reactionDescription: '',
    severity: '',
    occurrenceDate: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!formData.occurrenceDate) {
      setError(t('dateRequired', 'Debe seleccionar la fecha de ocurrencia'));
      return false;
    }
    if (!patientUuid || !locationUuid) {
      setError(t('missingPatientOrLocation', 'No se pudo resolver el paciente o la ubicación de sesión'));
      return false;
    }
    return true;
  }, [formData, locationUuid, patientUuid, t]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);
      try {
        await saveAdverseReaction({
          patientUuid,
          locationUuid,
          vaccineName: formData.vaccineName,
          reactionDescription: formData.reactionDescription,
          severity: formData.severity as Exclude<AdverseReaction['severity'], ''>,
          occurrenceDate: formData.occurrenceDate,
          config,
        });

        showSnackbar({
          kind: 'success',
          title: t('reactionSaved', 'Reacción registrada'),
          subtitle: t('reactionSavedSubtitle', 'La reacción adversa ha sido registrada exitosamente'),
          isLowContrast: true,
        });
        closeWorkspace({ discardUnsavedChanges: true });
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: t('reactionSaveError', 'Error al registrar reacción'),
          subtitle: (error as Error)?.message ?? t('unexpectedError', 'Ocurrió un error inesperado'),
          isLowContrast: false,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [closeWorkspace, config, formData, locationUuid, patientUuid, validateForm, t],
  );

  return (
    <RequirePrivilege privilege={credImmunizationEditPrivilege}>
      <Form className={styles.adverseReactionForm} onSubmit={handleSubmit}>
        <div style={{ padding: '1rem' }}>
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
            labelText={t('vaccine', 'Vacuna')}
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
            labelText={t('reactionDescription', 'Descripción de la reacción')}
            value={formData.reactionDescription}
            onChange={(e) => handleInputChange('reactionDescription', e.target.value)}
            rows={4}
            placeholder={t('reactionPlaceholder', 'Describa los síntomas observados...')}
            className={styles.formField}
          />

          <Select
            id="severity-select"
            labelText={t('severity', 'Severidad')}
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
              id="occurrence-date"
              labelText={t('occurrenceDate', 'Fecha de ocurrencia del evento')}
              maxDate={new Date()}
              value={formData.occurrenceDate}
              onChange={(date) => handleInputChange('occurrenceDate', date)}
            />
          </div>
        </div>

        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <Button kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button kind="primary" type="submit" disabled={isSubmitting}>
            {t('registerReaction', 'Registrar Reacción')}
          </Button>
        </ButtonSet>
      </Form>
    </RequirePrivilege>
  );
};

export default AdverseReactionFormWorkspace;
