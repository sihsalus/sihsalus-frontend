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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { ConfigObject } from '../../../config-schema';
import { credCourseLifeEditPrivilege } from '../../../constants';
import { useAgeGroups } from '../../../hooks/useAgeGroups';
import { groupCREDControlEncounters } from '../../../hooks/useCREDSchedule';
import { useCREDFormsForAgeGroup } from '../../../hooks/useCREDFormsForAgeGroup';
import useCREDEncounters from '../../../hooks/useEncountersCRED';
import { type DefaultPatientWorkspaceProps } from '../../../types';
import EncounterDateTimeSection from '../../../ui/encounter-date-time/encounter-date-time.component';

import styles from './well-child-controls-form.scss';

const createCREDControlsSchema = (t: (key: string, fallback: string) => string) =>
  z.object({
    visitStartDate: z.date({
      required_error: t('consultationDateRequired', 'Fecha de atención es requerida'),
    }),
    visitStartTime: z
      .string()
      .regex(/^(0[1-9]|1[0-2]):([0-5][0-9])$/, t('consultationTimeRequired', 'Hora de atención es requerida')),
    visitStartTimeFormat: z.enum(['AM', 'PM']),
    controlNumber: z.string().optional(),
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

const CREDControlsWorkspace: React.FC<DefaultPatientWorkspaceProps> = ({
  closeWorkspace,
  workspaceProps,
  patientUuid: directPatientUuid,
}) => {
  const patientUuid = directPatientUuid ?? workspaceProps?.patientUuid ?? '';
  const { t } = useTranslation();
  const CREDControlsSchema = useMemo(() => createCREDControlsSchema(t), [t]);
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const { patient, isLoading: isPatientLoading } = usePatient(patientUuid);
  const { activeVisit, currentVisit } = useVisit(patientUuid);
  const visit = currentVisit ?? activeVisit;
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

  const credControlNumber = useMemo(() => Math.min(encounters.length + 1, 27), [encounters.length]);

  const ageGroup = useMemo(() => {
    if (!patient?.birthDate) return null;
    try {
      return getAgeGroupForForms(patient.birthDate);
    } catch (error) {
      console.warn('Error getting age group:', error);
      return null;
    }
  }, [patient?.birthDate, getAgeGroupForForms]);

  const formattedAge = useMemo(() => (patient?.birthDate ? age(patient.birthDate) : ''), [patient?.birthDate]);

  const consultationDate = watch('visitStartDate');
  const allAvailableForms = useCREDFormsForAgeGroup(config, patient?.birthDate, consultationDate);

  const handleStartControl = useCallback(
    (consultationData: CREDControlsFormType) => {
      if (!consultationData.visitStartDate || !consultationData.visitStartTime || !visit) {
        setShowErrorNotification(true);
        return;
      }
      const consultationDatetime = getConsultationDatetime(consultationData);

      if (consultationDatetime > new Date()) {
        setShowErrorNotification(true);
        return;
      }
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
    [
      patientUuid,
      visit,
      allAvailableForms,
      formattedAge,
      patient?.birthDate,
      credControlNumber,
      t,
    ],
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
    setValue('controlNumber', credControlNumber.toString());
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
          <EncounterDateTimeSection
            control={control}
            firstEncounterDateTime={
              encounters[0]?.encounterDatetime ? new Date(encounters[0].encounterDatetime).getTime() : undefined
            }
          />

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
                value={credControlNumber.toString()}
                readOnly
                disabled
                helperText={t('controlNumberHelper', '* Calculado automáticamente')}
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
                helperText={t('ageGroupHelper', '* Grupo etario basado en la edad del paciente')}
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

          {showErrorNotification && (
            <InlineNotification
              className={styles.errorNotification}
              lowContrast={false}
              onClose={() => setShowErrorNotification(false)}
              title={t('error', 'Error')}
              subtitle={t(
                'completeRequiredFields',
                'Por favor complete los campos requeridos (Fecha y Hora de atención).',
              )}
            />
          )}
        </div>

        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('discard', 'Discard')}
          </Button>
          <Button className={styles.button} kind="primary" disabled={!visit || isSubmitting} type="submit">
            {t('startControl', 'Empezar Control')}
          </Button>
        </ButtonSet>
      </Form>
    </RequirePrivilege>
  );
};

export default CREDControlsWorkspace;
