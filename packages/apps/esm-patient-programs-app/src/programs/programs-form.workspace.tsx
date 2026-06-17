import {
  Button,
  ButtonSet,
  Form,
  FormGroup,
  FormLabel,
  InlineLoading,
  InlineNotification,
  Layer,
  Select,
  SelectItem,
  Stack,
  TextInput,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getCoreTranslation,
  OpenmrsDatePicker,
  parseDate,
  showSnackbar,
  useConfig,
  useLayoutType,
  usePatient,
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  type PatientWorkspace2DefinitionProps,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import React, { useCallback, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { type ConfigObject } from '../config-schema';
import { mutatePatientProgramEnrollments } from './program-enrollment-cache';
import {
  createProgramEnrollment,
  findLastState,
  updateProgramEnrollment,
  useAvailablePrograms,
  useEnrollments,
} from './programs.resource';
import styles from './programs-form.scss';

export interface ProgramsFormProps {
  programEnrollmentId?: string;
}

const createProgramsFormSchema = (t: TFunction) =>
  z.object({
    selectedProgram: z.string().refine((value) => !!value, t('programRequired', 'Program is required')),
    enrollmentDate: z.date(),
    completionDate: z.date().optional().nullable(),
    selectedProgramStatus: z.string(),
  });

export type ProgramsFormData = z.infer<ReturnType<typeof createProgramsFormSchema>>;

type ProgramsWorkspaceDefinitionProps = PatientWorkspace2DefinitionProps<ProgramsFormProps, {}>;
type LegacyProgramsWorkspaceProps = DefaultPatientWorkspaceProps & ProgramsFormProps;
type ProgramsWorkspaceProps = ProgramsWorkspaceDefinitionProps | LegacyProgramsWorkspaceProps;

function isWorkspace2Props(props: ProgramsWorkspaceProps): props is ProgramsWorkspaceDefinitionProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

const ProgramsForm: React.FC<ProgramsWorkspaceProps> = (props) => {
  const closeWorkspace = props.closeWorkspace;
  const patientUuid = isWorkspace2Props(props) ? props.groupProps.patientUuid : props.patientUuid;
  const workspacePatient = isWorkspace2Props(props)
    ? props.groupProps.patient
    : 'patient' in props
      ? props.patient
      : undefined;
  const programEnrollmentId = isWorkspace2Props(props)
    ? props.workspaceProps.programEnrollmentId
    : props.programEnrollmentId;
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const { patient: fetchedPatient } = usePatient(patientUuid);
  const patient = workspacePatient ?? fetchedPatient;
  const { data: enrollments } = useEnrollments(patientUuid);
  const config = useConfig<ConfigObject>();
  const { data: availablePrograms, eligiblePrograms: eligibleAvailablePrograms } = useAvailablePrograms(
    enrollments ?? [],
    patient,
    config?.programEligibilityRules ?? [],
  );
  const inEditMode = Boolean(programEnrollmentId);
  const patientEnrollments = enrollments ?? [];
  const availableProgramsList = availablePrograms ?? [];

  const programsFormSchema = useMemo(() => createProgramsFormSchema(t), [t]);

  const currentEnrollment = programEnrollmentId && patientEnrollments.filter((e) => e.uuid === programEnrollmentId)[0];
  const currentProgram = currentEnrollment
    ? {
        display: currentEnrollment.program.name,
        ...currentEnrollment.program,
      }
    : null;

  const eligiblePrograms = currentProgram ? [currentProgram] : eligibleAvailablePrograms;
  const hasConfiguredPrograms = availableProgramsList.length > 0;
  const hasEligiblePrograms = Boolean(eligiblePrograms?.length);

  const enrollmentLocationUuid = currentEnrollment?.location?.uuid ?? session?.sessionLocation?.uuid ?? '';
  const enrollmentLocationDisplay =
    currentEnrollment?.location?.display ??
    session?.sessionLocation?.display ??
    t('currentLocationUnavailable', 'Current location unavailable');

  const currentState = currentEnrollment ? findLastState(currentEnrollment.states) : null;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProgramsFormData>({
    mode: 'all',
    resolver: zodResolver(programsFormSchema),
    defaultValues: {
      selectedProgram: currentEnrollment?.program.uuid ?? '',
      enrollmentDate: currentEnrollment?.dateEnrolled ? parseDate(currentEnrollment.dateEnrolled) : new Date(),
      completionDate: currentEnrollment?.dateCompleted ? parseDate(currentEnrollment.dateCompleted) : null,
      selectedProgramStatus: currentState?.state.uuid ?? '',
    },
  });

  const selectedProgram = useWatch({ control, name: 'selectedProgram' });

  const onSubmit = useCallback(
    async (data: ProgramsFormData) => {
      const { selectedProgram, enrollmentDate, completionDate, selectedProgramStatus } = data;

      if (!enrollmentLocationUuid) {
        showSnackbar({
          kind: 'error',
          title: t('programEnrollmentSaveError', 'Error saving program enrollment'),
          subtitle: t(
            'programEnrollmentLocationRequired',
            'A current session location is required to enroll a patient in a program',
          ),
        });
        return;
      }

      const payload = {
        patient: patientUuid,
        program: selectedProgram,
        dateEnrolled: enrollmentDate ? dayjs(enrollmentDate).format() : null,
        dateCompleted: completionDate ? dayjs(completionDate).format() : null,
        location: enrollmentLocationUuid,
        states:
          !!selectedProgramStatus && selectedProgramStatus !== currentState?.state.uuid
            ? [{ state: { uuid: selectedProgramStatus } }]
            : [],
      };

      try {
        const abortController = new AbortController();

        if (currentEnrollment) {
          await updateProgramEnrollment(currentEnrollment.uuid, payload, abortController);
        } else {
          await createProgramEnrollment(payload, abortController);
        }

        await mutatePatientProgramEnrollments(patientUuid);
        closeWorkspace({ discardUnsavedChanges: true });

        showSnackbar({
          kind: 'success',
          title: currentEnrollment
            ? t('enrollmentUpdated', 'Program enrollment updated')
            : t('enrollmentSaved', 'Program enrollment saved'),
          subtitle: currentEnrollment
            ? t('enrollmentUpdatesNowVisible', 'Changes to the program are now visible in the Programs table')
            : t('enrollmentNowVisible', 'It is now visible in the Programs table'),
        });
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: t('programEnrollmentSaveError', 'Error saving program enrollment'),
          subtitle: error instanceof Error ? error.message : 'An unknown error occurred',
        });
      }
    },
    [closeWorkspace, currentEnrollment, currentState, enrollmentLocationUuid, patientUuid, t],
  );

  const programName = (
    <FormGroup legendText={t('programName', 'Program name')}>
      <FormLabel className={styles.programName}>{currentProgram?.display}</FormLabel>
    </FormGroup>
  );

  const programSelect = (
    <Controller
      name="selectedProgram"
      control={control}
      render={({ field: { onChange, value } }) => (
        <Select
          aria-label="program name"
          id="program"
          invalid={!!errors?.selectedProgram}
          invalidText={errors?.selectedProgram?.message}
          labelText={t('programName', 'Program name')}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          <SelectItem text={t('chooseProgram', 'Choose a program')} value="" />
          {eligiblePrograms?.length > 0 &&
            eligiblePrograms.map((program) => (
              <SelectItem key={program.uuid} text={program.display} value={program.uuid}>
                {program.display}
              </SelectItem>
            ))}
        </Select>
      )}
    />
  );

  const enrollmentDate = (
    <Controller
      name="enrollmentDate"
      control={control}
      render={({ field, fieldState }) => (
        <OpenmrsDatePicker
          {...field}
          id="enrollmentDate"
          data-testid="enrollmentDate"
          maxDate={(() => {
            const completionDate = watch('completionDate');
            return completionDate ? dayjs(completionDate).subtract(1, 'day').toDate() : new Date();
          })()}
          labelText={t('dateEnrolled', 'Date enrolled')}
          invalid={Boolean(fieldState?.error?.message)}
          invalidText={fieldState?.error?.message}
        />
      )}
    />
  );

  const completionDate = (
    <Controller
      name="completionDate"
      control={control}
      render={({ field, fieldState }) => (
        <OpenmrsDatePicker
          {...field}
          id="completionDate"
          data-testid="completionDate"
          minDate={dayjs(watch('enrollmentDate')).add(1, 'day').toDate()}
          maxDate={new Date()}
          isDisabled={dayjs(watch('enrollmentDate')).isSame(dayjs(), 'day')}
          labelText={t('dateCompleted', 'Date completed')}
          invalid={Boolean(fieldState?.error?.message)}
          invalidText={fieldState?.error?.message}
        />
      )}
    />
  );

  const enrollmentLocation = (
    <TextInput
      id="enrollmentLocation"
      labelText={t('enrollmentLocation', 'Enrollment location')}
      readOnly
      value={enrollmentLocationDisplay}
    />
  );

  let workflowStates = [];
  if (!currentProgram && !!selectedProgram) {
    const program = eligiblePrograms.find((p) => p.uuid === selectedProgram);
    if (program?.allWorkflows.length > 0) workflowStates = program.allWorkflows[0].states;
  } else if (currentProgram?.allWorkflows.length > 0) {
    workflowStates = currentProgram.allWorkflows[0].states;
  }

  const programStatusDropdown = (
    <Controller
      name="selectedProgramStatus"
      control={control}
      render={({ field: { onChange, value } }) => (
        <Select
          aria-label={t('programStatus', 'Program status')}
          id="programStatus"
          invalid={!!errors?.selectedProgramStatus}
          invalidText={errors?.selectedProgramStatus?.message}
          labelText={t('programStatus', 'Program status')}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          <SelectItem text={t('chooseStatus', 'Choose a program status')} value="" />
          {workflowStates.map((state) => (
            <SelectItem key={state.uuid} text={state.concept.display} value={state.uuid}>
              {state.concept.display}
            </SelectItem>
          ))}
        </Select>
      )}
    />
  );

  const formGroups = [
    inEditMode
      ? {
          id: 'program-name',
          style: { maxWidth: isTablet && '50%' },
          legendText: '',
          value: programName,
        }
      : {
          id: 'program-select',
          style: { maxWidth: isTablet && '50%' },
          legendText: '',
          value: programSelect,
        },
    {
      id: 'enrollment-date',
      style: { maxWidth: '50%' },
      legendText: '',
      value: enrollmentDate,
    },
    {
      id: 'completion-date',
      style: { width: '50%' },
      legendText: '',
      value: completionDate,
    },
    {
      id: 'enrollment-location',
      style: { width: '100%' },
      legendText: '',
      value: enrollmentLocation,
    },
  ];

  if (config?.showProgramStatusField) {
    formGroups.push({
      id: 'program-status',
      style: { width: '50%' },
      legendText: '',
      value: programStatusDropdown,
    });
  }

  return (
    <Workspace2 title={t('programEnrollmentWorkspaceTitle', 'Program enrollment')} hasUnsavedChanges={isDirty}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Stack className={styles.formContainer} gap={7}>
          {!hasConfiguredPrograms && (
            <InlineNotification
              className={styles.notification}
              kind="error"
              lowContrast
              subtitle={t('configurePrograms', 'Please configure programs to continue.')}
              title={t('noProgramsConfigured', 'No programs configured')}
            />
          )}
          {hasConfiguredPrograms && !hasEligiblePrograms && !inEditMode && (
            <InlineNotification
              className={styles.notification}
              kind="info"
              lowContrast
              subtitle={t('noEligibleEnrollments', 'There are no more programs left to enroll this patient in')}
              title={t('noEligiblePrograms', 'No eligible programs available')}
            />
          )}
          {formGroups.map((group) => (
            <FormGroup style={group.style} legendText={group.legendText} key={group.id}>
              <div className={styles.selectContainer}>{isTablet ? <Layer>{group.value}</Layer> : group.value}</div>
            </FormGroup>
          ))}
        </Stack>
        <ButtonSet className={classNames(isTablet ? styles.tablet : styles.desktop)}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {getCoreTranslation('cancel')}
          </Button>
          <Button
            className={styles.button}
            disabled={isSubmitting || (!inEditMode && !hasEligiblePrograms)}
            kind="primary"
            type="submit"
          >
            {isSubmitting ? (
              <InlineLoading description={t('saving', 'Saving') + '...'} />
            ) : (
              <span>{t('saveAndClose', 'Save and close')}</span>
            )}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default ProgramsForm;
