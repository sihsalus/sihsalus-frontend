import { Button, ButtonSet, Column, Form, InlineNotification, TextInput, Tooltip } from '@carbon/react';
import { Information as InformationIcon } from '@carbon/react/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  age,
  launchWorkspace2,
  ResponsiveWrapper,
  useConfig,
  useLayoutType,
  usePatient,
  useVisit,
} from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { ConfigObject } from '../../../config-schema';
import { credCourseLifeEditPrivilege } from '../../../constants';
import { useAgeGroups } from '../../../hooks/useAgeGroups';
import { useCREDFormsForAgeGroup } from '../../../hooks/useCREDFormsForAgeGroup';
import { groupCREDControlEncounters } from '../../../hooks/useCREDSchedule';
import useCREDEncounters, { type CREDEncounter } from '../../../hooks/useEncountersCRED';
import { type DefaultPatientWorkspaceProps } from '../../../types';
import EncounterDateTimeSection from '../../../ui/encounter-date-time/encounter-date-time.component';

import styles from './well-child-controls-form.scss';

export const createCREDControlsSchema = (
  t: (key: string, fallback: string) => string,
  patientBirthDate?: string | Date,
  visitStartDatetime?: string | Date,
  visitStopDatetime?: string | Date,
) =>
  z
    .object({
      visitStartDate: z.date({
        required_error: t('consultationDateRequired', 'Fecha de atención es requerida'),
      }),
      visitStartTime: z
        .string()
        .regex(/^(0[1-9]|1[0-2]):([0-5][0-9])$/, t('consultationTimeRequired', 'Hora de atención es requerida')),
      visitStartTimeFormat: z.enum(['AM', 'PM']),
      controlNumber: z.string().optional(),
    })
    .superRefine((data, context) => {
      const consultationDatetime = getConsultationDatetime(data);
      const chronologyError = getCREDConsultationChronologyError(
        consultationDatetime,
        patientBirthDate,
        new Date(),
        visitStartDatetime,
        visitStopDatetime,
      );

      if (chronologyError === 'beforeBirth') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['visitStartDate'],
          message: t(
            'credConsultationBeforeBirth',
            'La fecha de atención no puede ser anterior a la fecha de nacimiento del paciente.',
          ),
        });
      }

      if (chronologyError === 'future') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['visitStartTime'],
          message: t('credConsultationInFuture', 'La fecha y hora de atención no puede estar en el futuro.'),
        });
      }

      if (chronologyError === 'beforeVisit') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path:
            visitStartDatetime && dayjs(consultationDatetime).isSame(dayjs(visitStartDatetime), 'day')
              ? ['visitStartTime']
              : ['visitStartDate'],
          message: t(
            'credConsultationBeforeVisit',
            'La fecha y hora de atención no puede ser anterior al inicio de la visita.',
          ),
        });
      }

      if (chronologyError === 'afterVisit') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path:
            visitStopDatetime && dayjs(consultationDatetime).isSame(dayjs(visitStopDatetime), 'day')
              ? ['visitStartTime']
              : ['visitStartDate'],
          message: t(
            'credConsultationAfterVisit',
            'La fecha y hora de atención no puede ser posterior al cierre de la visita.',
          ),
        });
      }
    });

type CREDControlsFormType = z.infer<ReturnType<typeof createCREDControlsSchema>>;

export function getConsultationDatetime({
  visitStartDate,
  visitStartTime,
  visitStartTimeFormat,
}: Pick<CREDControlsFormType, 'visitStartDate' | 'visitStartTime' | 'visitStartTimeFormat'>): Date {
  const [rawHour, minute] = visitStartTime.split(':').map(Number);
  const hour = (rawHour % 12) + (visitStartTimeFormat === 'PM' ? 12 : 0);
  const consultationDatetime = new Date(visitStartDate);

  consultationDatetime.setHours(hour, minute, 0, 0);
  return consultationDatetime;
}

export type CREDConsultationChronologyError = 'beforeBirth' | 'future' | 'beforeVisit' | 'afterVisit' | null;

export function getCREDConsultationChronologyError(
  consultationDatetime: Date,
  patientBirthDate?: string | Date,
  now = new Date(),
  visitStartDatetime?: string | Date,
  visitStopDatetime?: string | Date,
): CREDConsultationChronologyError {
  if (
    patientBirthDate &&
    dayjs(patientBirthDate).isValid() &&
    dayjs(consultationDatetime).isBefore(dayjs(patientBirthDate), 'day')
  ) {
    return 'beforeBirth';
  }

  if (consultationDatetime > now) return 'future';

  if (
    visitStartDatetime &&
    dayjs(visitStartDatetime).isValid() &&
    dayjs(consultationDatetime).isBefore(dayjs(visitStartDatetime))
  ) {
    return 'beforeVisit';
  }

  if (
    visitStopDatetime &&
    dayjs(visitStopDatetime).isValid() &&
    dayjs(consultationDatetime).isAfter(dayjs(visitStopDatetime))
  ) {
    return 'afterVisit';
  }

  return null;
}

export function getCREDMinimumConsultationDate(
  patientBirthDate?: string | Date,
  visitStartDatetime?: string | Date,
): string | Date | undefined {
  if (!patientBirthDate) return visitStartDatetime;
  if (!visitStartDatetime) return patientBirthDate;

  return dayjs(visitStartDatetime).isAfter(dayjs(patientBirthDate)) ? visitStartDatetime : patientBirthDate;
}

export function resolveCREDControlNumber(
  encounters: CREDEncounter[],
  consultationDate: Date,
  visitUuid?: string,
): number | null {
  const sortedEncounters = [...encounters]
    .filter((encounter) => encounter.encounterDatetime)
    .sort(
      (first, second) =>
        new Date(first.encounterDatetime ?? 0).getTime() - new Date(second.encounterDatetime ?? 0).getTime(),
    );
  const matchingControlIndex = sortedEncounters.findIndex(
    (encounter) =>
      encounter.visit?.uuid === visitUuid && dayjs(encounter.encounterDatetime).isSame(dayjs(consultationDate), 'day'),
  );

  if (matchingControlIndex >= 0) {
    const persistedControlNumber = sortedEncounters[matchingControlIndex].controlNumber;
    return typeof persistedControlNumber === 'number' && persistedControlNumber >= 1 && persistedControlNumber <= 27
      ? persistedControlNumber
      : Math.min(matchingControlIndex + 1, 27);
  }

  const highestPersistedControlNumber = sortedEncounters.reduce(
    (highest, encounter) =>
      Number.isInteger(encounter.controlNumber) && Number(encounter.controlNumber) >= 1
        ? Math.max(highest, Number(encounter.controlNumber))
        : highest,
    0,
  );
  const nextControlNumber = Math.max(sortedEncounters.length, highestPersistedControlNumber) + 1;

  return nextControlNumber <= 27 ? nextControlNumber : null;
}

const CREDControlsWorkspace: React.FC<DefaultPatientWorkspaceProps> = ({
  closeWorkspace,
  workspaceProps,
  patientUuid: directPatientUuid,
}) => {
  const patientUuid = directPatientUuid ?? workspaceProps?.patientUuid ?? '';
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const { patient, isLoading: isPatientLoading } = usePatient(patientUuid);
  const { activeVisit, currentVisit } = useVisit(patientUuid);
  const visit = currentVisit ?? activeVisit;
  const CREDControlsSchema = useMemo(
    () => createCREDControlsSchema(t, patient?.birthDate, visit?.startDatetime, visit?.stopDatetime),
    [patient?.birthDate, t, visit?.startDatetime, visit?.stopDatetime],
  );
  const { encounters: rawEncounters, isLoading: isEncountersLoading } = useCREDEncounters(patientUuid);
  const encounters = useMemo(() => groupCREDControlEncounters(rawEncounters ?? []), [rawEncounters]);
  const { getAgeGroupForForms } = useAgeGroups();
  const [showErrorNotification, setShowErrorNotification] = useState(false);

  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<CREDControlsFormType>({
    mode: 'all',
    resolver: zodResolver(CREDControlsSchema),
    defaultValues: {
      visitStartDate: new Date(),
      visitStartTime: new Date()
        .toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        .split(' ')[0],
      visitStartTimeFormat: new Date().getHours() >= 12 ? 'PM' : 'AM',
    },
  });

  const consultationDate = watch('visitStartDate');
  const credControlNumber = useMemo(
    () => resolveCREDControlNumber(encounters, consultationDate, visit?.uuid),
    [consultationDate, encounters, visit?.uuid],
  );

  const ageGroup = useMemo(() => {
    if (!patient?.birthDate) return null;
    try {
      return getAgeGroupForForms(patient.birthDate, consultationDate);
    } catch (error) {
      console.warn('Error getting age group:', error);
      return null;
    }
  }, [consultationDate, patient?.birthDate, getAgeGroupForForms]);

  const formattedAge = useMemo(
    () => (patient?.birthDate ? age(patient.birthDate, consultationDate) : ''),
    [consultationDate, patient?.birthDate],
  );

  const allAvailableForms = useCREDFormsForAgeGroup(config, patient?.birthDate, consultationDate);
  const minimumConsultationDate = useMemo(
    () => getCREDMinimumConsultationDate(patient?.birthDate, visit?.startDatetime),
    [patient?.birthDate, visit?.startDatetime],
  );

  const handleStartControl = useCallback(
    (consultationData: CREDControlsFormType) => {
      if (!consultationData.visitStartDate || !consultationData.visitStartTime || !visit || credControlNumber === null) {
        setShowErrorNotification(true);
        return;
      }
      const consultationDatetime = getConsultationDatetime(consultationData);
      setShowErrorNotification(false);

      launchWorkspace2('forms-selector-workspace', {
        availableForms: allAvailableForms,
        patientUuid,
        patientAge: formattedAge,
        patientBirthDate: patient?.birthDate,
        controlNumber: credControlNumber,
        consultationDatetime: consultationDatetime.toISOString(),
        title: t('credFormsSelection', 'Selección de Formularios Crecimiento y Desarrollo'),
        subtitle: t(
          'credFormsInstructions',
          'Seleccione los formularios que desea completar para este control Crecimiento y Desarrollo.',
        ),
        backWorkspace: 'wellchild-control-form',
      });
    },
    [patientUuid, visit, allAvailableForms, formattedAge, patient?.birthDate, credControlNumber, t],
  );

  useEffect(() => {
    const now = new Date();
    setValue('visitStartDate', now);
    setValue(
      'visitStartTime',
      now
        .toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        .split(' ')[0],
    );
    setValue('visitStartTimeFormat', now.getHours() >= 12 ? 'PM' : 'AM');
  }, [setValue]);

  useEffect(() => {
    setValue('controlNumber', credControlNumber?.toString() ?? '');
  }, [setValue, credControlNumber]);

  if (isPatientLoading || isEncountersLoading) {
    return (
      <ResponsiveWrapper>
        <div className={styles.loadingContainer}>{t('loading', 'Loading...')}</div>
      </ResponsiveWrapper>
    );
  }

  return (
    <RequirePrivilege privilege={credCourseLifeEditPrivilege}>
      <Form className={styles.form} onSubmit={handleSubmit(handleStartControl, () => setShowErrorNotification(true))}>
        <div className={styles.grid}>
          <EncounterDateTimeSection control={control} minDate={minimumConsultationDate} />

          <div>
            <div className={styles.sectionTitle}>{t('detailsOfLastControl', 'Detalles del Último Control')}</div>
            <Column lg={4} md={2} sm={2}>
              <TextInput
                id="lastControlDate"
                labelText={t('lastControlDate', 'Fecha de Último control')}
                value={
                  encounters.length > 0
                    ? new Date(encounters[encounters.length - 1].encounterDatetime).toLocaleDateString('es-PE')
                    : t('neverPerformed', 'Nunca se ha hecho')
                }
                readOnly
                disabled
                helperText={t('lastControlHelper', '* Fecha del último control realizado')}
              />
            </Column>
            <Column lg={4} md={2} sm={2}>
              <TextInput
                id="controlNumber"
                labelText={t('controlNumber', 'Control number')}
                value={credControlNumber?.toString() ?? t('notAvailable', 'No disponible')}
                readOnly
                disabled
                helperText={
                  credControlNumber === null
                    ? t('credControlLimitReached', '* Se alcanzó el máximo de 27 controles CRED')
                    : t('controlNumberHelper', '* Calculado automáticamente')
                }
                {...register('controlNumber')}
              />
            </Column>
          </div>

          <div className={styles.controlInfoRow}>
            <Column lg={4} md={2} sm={2}>
              <TextInput
                id="ageGroup"
                labelText={t('patientAgeGroup', 'Grupo Etario del Paciente')}
                value={ageGroup ? ageGroup.label : t('unknownAgeGroup', 'No determinado')}
                readOnly
                disabled
                helperText={t('ageGroupHelper', '* Grupo etario calculado a la fecha de atención')}
              />
            </Column>
            <Tooltip
              align="top"
              label={
                <div className={styles.ageGroupTooltipInfo}>
                  <p className={styles.tooltipTitle}>
                    {t('ageGroupsInfo', 'Información de Grupos Etarios Crecimiento y Desarrollo:')}
                  </p>
                  <ul className={styles.ageGroupsList}>
                    <li>{t('recienNacido', 'Recién Nacido: 0-28 días')}</li>
                    <li>{t('lactanteMenor', 'Lactante Menor: 29 días - 11 meses')}</li>
                    <li>{t('lactanteMayor', 'Lactante Mayor: 12-23 meses')}</li>
                    <li>{t('preescolar', 'Preescolar: 2-4 años')}</li>
                    <li>{t('escolar', 'Escolar: 5-11 años')}</li>
                  </ul>
                </div>
              }
            >
              <button className={styles.tooltipButton} type="button">
                <InformationIcon className={styles.icon} size={20} />
              </button>
            </Tooltip>
          </div>

          {credControlNumber === null && (
            <InlineNotification
              className={styles.errorNotification}
              hideCloseButton
              kind="warning"
              lowContrast={false}
              title={t('credControlLimitTitle', 'No se pueden registrar más controles CRED')}
              subtitle={t(
                'credControlLimitSubtitle',
                'El paciente ya alcanzó el máximo normativo de 27 controles registrados.',
              )}
            />
          )}

          {showErrorNotification && (
            <InlineNotification
              className={styles.errorNotification}
              lowContrast={false}
              onClose={() => setShowErrorNotification(false)}
              title={t('error', 'Error')}
              subtitle={t('completeRequiredFields', 'Revise los campos marcados en rojo y corrija la información.')}
            />
          )}
        </div>

        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('discard', 'Discard')}
          </Button>
          <Button
            className={styles.button}
            kind="primary"
            disabled={!visit || isSubmitting || credControlNumber === null}
            type="submit"
          >
            {t('startControl', 'Empezar Control')}
          </Button>
        </ButtonSet>
      </Form>
    </RequirePrivilege>
  );
};

export default CREDControlsWorkspace;
