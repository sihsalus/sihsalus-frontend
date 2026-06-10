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
import { EncounterDateTimeSection } from '@sihsalus/esm-sihsalus-shared';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { credCourseLifeEditPrivilege } from '../../../constants';
import type { ConfigObject } from '../../../config-schema';
import { useAgeGroups } from '../../../hooks/useAgeGroups';
import { useCREDFormsForAgeGroup } from '../../../hooks/useCREDFormsForAgeGroup';
import useCREDEncounters from '../../../hooks/useEncountersCRED';
import { DashboardAccess } from '../../../rbac';
import { type DefaultPatientWorkspaceProps } from '../../../types';

import styles from './well-child-controls-form.scss';

const createCREDControlsSchema = (t: (key: string, fallback: string) => string) =>
  z.object({
    consultationDate: z.date({ required_error: t('consultationDateRequired', 'Fecha de atención es requerida') }),
    consultationTime: z.string().min(1, t('consultationTimeRequired', 'Hora de atención es requerida')),
    controlNumber: z.string().optional(),
    attendedAge: z.string().optional(),
  });

type CREDControlsFormType = z.infer<ReturnType<typeof createCREDControlsSchema>>;

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
  const encounters = useMemo(() => rawEncounters ?? [], [rawEncounters]);
  const { getAgeGroupForForms } = useAgeGroups();
  const selectedControl = workspaceProps?.control;

  const [showErrorNotification, setShowErrorNotification] = useState(false);

  const {
    control,
    watch,
    formState: { isSubmitting },
    register,
    setValue,
  } = useForm<CREDControlsFormType>({
    mode: 'all',
    resolver: zodResolver(CREDControlsSchema),
    defaultValues: {
      consultationDate: new Date(),
      consultationTime: new Date().toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    },
  });

  const credControlNumber = useMemo(
    () => selectedControl?.controlNumber ?? (encounters ? encounters.length + 1 : 1),
    [encounters, selectedControl?.controlNumber],
  );

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

  const allAvailableForms = useCREDFormsForAgeGroup(config, patient?.birthDate, selectedControl?.targetDate);

  const handleStartControl = useCallback(() => {
    const consultationData = watch();
    if (!consultationData.consultationDate || !consultationData.consultationTime || !visit) {
      setShowErrorNotification(true);
      return;
    }

    sessionStorage.setItem(
      'credConsultationData',
      JSON.stringify({
        ...consultationData,
        patientUuid,
        visitUuid: visit.uuid,
        controlNumber: credControlNumber,
        patientAge: formattedAge,
      }),
    );

    launchWorkspace2('forms-selector-workspace', {
      availableForms: allAvailableForms,
      patientUuid,
      patientAge: formattedAge,
      patientBirthDate: patient?.birthDate,
      controlTargetDate: selectedControl?.targetDate ? new Date(selectedControl.targetDate).toISOString() : undefined,
      controlNumber: credControlNumber,
      title: t('credFormsSelection', 'Selección de Formularios Crecimiento y Desarrollo'),
      subtitle: t(
        'credFormsInstructions',
        'Seleccione los formularios que desea completar para este control Crecimiento y Desarrollo.',
      ),
      backWorkspace: 'wellchild-control-form',
    });
  }, [
    watch,
    patientUuid,
    visit,
    allAvailableForms,
    formattedAge,
    patient?.birthDate,
    selectedControl?.targetDate,
    credControlNumber,
    t,
  ]);

  useEffect(() => {
    const now = new Date();
    setValue('consultationDate', now);
    setValue(
      'consultationTime',
      now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }),
    );
    setValue('controlNumber', credControlNumber.toString());
    setValue('attendedAge', ageGroup ? ageGroup.label : formattedAge);
  }, [setValue, credControlNumber, ageGroup, formattedAge]);

  if (isPatientLoading || isEncountersLoading) {
    return (
      <ResponsiveWrapper>
        <div className={styles.loadingContainer}>{t('loading', 'Loading...')}</div>
      </ResponsiveWrapper>
    );
  }

  return (
    <DashboardAccess privilege={credCourseLifeEditPrivilege}>
      <Form className={styles.form}>
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
        <Button
          className={styles.button}
          kind="primary"
          onClick={handleStartControl}
          disabled={!visit || isSubmitting}
          type="button"
        >
          {t('startControl', 'Empezar Control')}
        </Button>
      </ButtonSet>
      </Form>
    </DashboardAccess>
  );
};

export default CREDControlsWorkspace;
