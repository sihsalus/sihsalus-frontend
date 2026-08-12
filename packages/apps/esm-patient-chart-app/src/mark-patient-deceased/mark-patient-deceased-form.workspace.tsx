import {
  Button,
  ButtonSet,
  DatePicker,
  DatePickerInput,
  DatePickerSkeleton,
  Form,
  InlineNotification,
  InlineLoading,
  RadioButton,
  RadioButtonGroup,
  Row,
  Search,
  StructuredListSkeleton,
  TextInput,
  Tile,
} from '@carbon/react';
import { WarningFilled } from '@carbon/react/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ExtensionSlot,
  getUserFacingErrorMessage,
  ResponsiveWrapper,
  showSnackbar,
  useConfig,
  useLayoutType,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  EmptyState,
  type PatientWorkspace2DefinitionProps,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import fuzzy from 'fuzzy';
import React, { useCallback, useMemo, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { type ChartConfig } from '../config-schema';
import { useCausesOfDeath } from '../data.resource';
import { type DeathCareContext, reconcileDeceasedPatientWorkflow } from './deceased-patient-workflow.resource';

import styles from './mark-patient-deceased-form.scss';

type MarkPatientDeceasedWorkspace2Props = PatientWorkspace2DefinitionProps<object, object>;
type MarkPatientDeceasedWorkspaceProps = DefaultPatientWorkspaceProps | MarkPatientDeceasedWorkspace2Props;

function isWorkspace2Props(props: MarkPatientDeceasedWorkspaceProps): props is MarkPatientDeceasedWorkspace2Props {
  return 'groupProps' in props && 'workspaceProps' in props;
}

const MarkPatientDeceasedForm: React.FC<MarkPatientDeceasedWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const patientUuid = isWorkspace2Props(props) ? (props.groupProps?.patientUuid ?? '') : props.patientUuid;
  const isTablet = useLayoutType() === 'tablet';
  const memoizedPatientUuid = useMemo(() => ({ patientUuid }), [patientUuid]);
  const [searchTerm, setSearchTerm] = useState('');
  const { causesOfDeath, isLoading: isLoadingCausesOfDeath } = useCausesOfDeath();
  const { freeTextFieldConceptUuid } = useConfig<ChartConfig>();

  const filteredCausesOfDeath = useMemo(() => {
    if (!searchTerm) {
      return causesOfDeath;
    }
    return fuzzy
      .filter(searchTerm, causesOfDeath, {
        extract: (causeOfDeathConcept) => causeOfDeathConcept.display,
      })
      .sort((r1, r2) => r1.score - r2.score)
      .map((result) => result.original);
  }, [searchTerm, causesOfDeath]);

  const handleSearchTermChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const schema = z
    .object({
      causeOfDeath: z.string().refine((causeOfDeath) => !!causeOfDeath, {
        message: t('causeOfDeathIsRequired', 'Please select the cause of death'),
      }),
      deathDate: z.date().refine((date) => !!date, {
        message: t('deathDateRequired', 'Please select the date of death'),
      }),
      careContext: z.string().refine((value) => ['during-care', 'outside-care'].includes(value), {
        message: t('deathCareContextRequired', 'Select the care context in which the death was recorded'),
      }),
      nonCodedCauseOfDeath: z.string().optional(),
    })
    .refine((data) => !(data.causeOfDeath === freeTextFieldConceptUuid && !data.nonCodedCauseOfDeath), {
      message: t('nonCodedCauseOfDeathRequired', 'Please enter the non-coded cause of death'),
      path: ['nonCodedCauseOfDeath'],
    });

  type MarkPatientDeceasedFormSchema = z.infer<typeof schema>;

  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    watch,
  } = useForm<MarkPatientDeceasedFormSchema>({
    mode: 'onSubmit',
    resolver: zodResolver(schema),
    defaultValues: {
      causeOfDeath: '',
      deathDate: new Date(),
      careContext: '',
      nonCodedCauseOfDeath: '',
    },
  });

  const causeOfDeathValue = watch('causeOfDeath');

  const closeCurrentWorkspace = useCallback(
    async (discardUnsavedChanges = false) => {
      if (isWorkspace2Props(props)) {
        await props.closeWorkspace({ discardUnsavedChanges });
        return;
      }

      props.closeWorkspace(discardUnsavedChanges ? { ignoreChanges: true } : undefined);
    },
    [props],
  );

  const onSubmit: SubmitHandler<MarkPatientDeceasedFormSchema> = useCallback(
    async (data) => {
      const { careContext, causeOfDeath, deathDate, nonCodedCauseOfDeath } = data;

      try {
        await reconcileDeceasedPatientWorkflow({
          careContext: careContext as DeathCareContext,
          causeOfDeath,
          deathDate,
          nonCodedCauseOfDeath,
          patientUuid,
        });
        await closeCurrentWorkspace(true);
        globalThis.location.reload();
      } catch (error) {
        const reconciliationFailed =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'DECEASED_PATIENT_RECONCILIATION_FAILED';
        showSnackbar({
          kind: 'error',
          isLowContrast: false,
          subtitle: reconciliationFailed
            ? t(
                'errorReconcilingDeceasedPatientMessage',
                'The death was recorded, but visits, queues, or appointments could not all be closed. Correct the problem and save again; completed steps will not be repeated.',
              )
            : getUserFacingErrorMessage(
                error,
                t('errorMarkingPatientDeceasedMessage', 'No se pudo registrar el fallecimiento. Intente nuevamente.'),
                { logContext: 'Mark patient deceased' },
              ),
          title: reconciliationFailed
            ? t('errorReconcilingDeceasedPatient', 'Incomplete death workflow')
            : t('errorMarkingPatientDeceased', 'Error marking patient deceased'),
        });
      }
    },
    [closeCurrentWorkspace, patientUuid, t],
  );

  const content = (
    <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <div>
        {isTablet && (
          <Row className={styles.headerGridRow}>
            <ExtensionSlot className={styles.dataGridRow} name="visit-form-header-slot" state={memoizedPatientUuid} />
          </Row>
        )}
        <div className={styles.container}>
          <span className={styles.warningContainer}>
            <WarningFilled aria-label={t('warning', 'Warning')} className={styles.warningIcon} size={20} />
            <span className={styles.warningText}>
              {t('markDeceasedWarning', 'Marking the patient as deceased will end any active visits for this patient')}
            </span>
          </span>
          <InlineNotification
            hideCloseButton
            kind="info"
            lowContrast
            title={t('deathWorkflowTitle', 'Operational closure')}
            subtitle={t(
              'deathWorkflowDescription',
              'Active visits and queues will be closed. Pending appointments will be cancelled; a checked-in appointment is completed only when the death occurred during that care.',
            )}
          />
          <section>
            <div className={styles.sectionTitle}>{t('deathCareContext', 'Care context')}</div>
            <Controller
              name="careContext"
              control={control}
              render={({ field: { onChange, value } }) => (
                <RadioButtonGroup
                  className={styles.radioButtonGroup}
                  name="death-care-context"
                  orientation="vertical"
                  onChange={onChange}
                  valueSelected={value}
                >
                  <RadioButton
                    id="death-during-care"
                    labelText={t('deathDuringCare', 'During active care')}
                    value="during-care"
                  />
                  <RadioButton
                    id="death-outside-care"
                    labelText={t('deathOutsideCare', 'Outside active care or retrospective record')}
                    value="outside-care"
                  />
                </RadioButtonGroup>
              )}
            />
            {errors?.careContext && <p className={styles.errorMessage}>{errors.careContext.message}</p>}
          </section>
          <section>
            <div className={styles.sectionTitle}>{t('dateOfDeath', 'Date of death')}</div>
            {causesOfDeath?.length ? (
              <ResponsiveWrapper>
                <Controller
                  name="deathDate"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <DatePicker
                      className={styles.datePicker}
                      dateFormat="d/m/Y"
                      datePickerType="single"
                      maxDate={new Date().toISOString()}
                      onChange={([date]) => onChange(date)}
                      value={value}
                    >
                      <DatePickerInput
                        id="deceasedDateInput"
                        labelText={t('date', 'Date')}
                        placeholder="dd/mm/yyyy"
                        style={{ width: '100%' }}
                      />
                    </DatePicker>
                  )}
                />
                {errors?.deathDate && <p className={styles.errorMessage}>{errors?.deathDate?.message}</p>}
              </ResponsiveWrapper>
            ) : (
              <DatePickerSkeleton />
            )}
          </section>
          <section>
            <div className={styles.sectionTitle}>{t('causeOfDeath', 'Cause of death')}</div>
            <div
              className={classNames(styles.conceptAnswerOverviewWrapper, {
                [styles.conceptAnswerOverviewWrapperTablet]: isTablet,
                [styles.conceptAnswerOverviewWrapperDesktop]: !isTablet,
                [styles.errorOutline]: errors?.causeOfDeath?.message,
              })}
            >
              {isLoadingCausesOfDeath ? <StructuredListSkeleton /> : null}

              {causesOfDeath?.length ? (
                <ResponsiveWrapper>
                  <Search
                    labelText=""
                    onChange={handleSearchTermChange}
                    placeholder={t('searchForCauseOfDeath', 'Search for a cause of death')}
                  />
                </ResponsiveWrapper>
              ) : null}

              {causesOfDeath?.length && filteredCausesOfDeath.length > 0 ? (
                <Controller
                  name="causeOfDeath"
                  control={control}
                  render={({ field: { onChange } }) => (
                    <RadioButtonGroup
                      className={styles.radioButtonGroup}
                      name={
                        causeOfDeathValue === freeTextFieldConceptUuid
                          ? 'freeTextFieldCauseOfDeath'
                          : 'codedCauseOfDeath'
                      }
                      orientation="vertical"
                      onChange={onChange}
                    >
                      {filteredCausesOfDeath.map(({ uuid, display, name }) => (
                        <RadioButton
                          className={styles.radioButton}
                          id={name}
                          key={uuid}
                          labelText={display}
                          value={uuid}
                        />
                      ))}
                    </RadioButtonGroup>
                  )}
                />
              ) : null}

              {searchTerm && filteredCausesOfDeath.length === 0 && (
                <div className={styles.tileContainer}>
                  <Tile className={styles.tile}>
                    <div className={styles.tileContent}>
                      <p className={styles.content}>
                        {t('noMatchingCodedCausesOfDeath', 'No matching coded causes of death')}
                      </p>
                      <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                    </div>
                  </Tile>
                </div>
              )}

              {!isLoadingCausesOfDeath && !causesOfDeath?.length ? (
                <EmptyState
                  displayText={t('causeOfDeath_lower', 'cause of death concepts configured in the system')}
                  headerTitle={t('causeOfDeath', 'Cause of death')}
                />
              ) : null}
            </div>
            {errors?.causeOfDeath && <p className={styles.errorMessage}>{errors?.causeOfDeath?.message}</p>}
          </section>
        </div>
        {causeOfDeathValue === freeTextFieldConceptUuid && (
          <div className={styles.nonCodedCauseOfDeath}>
            <Controller
              name="nonCodedCauseOfDeath"
              control={control}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  id="freeTextCauseOfDeath"
                  invalid={!!errors?.nonCodedCauseOfDeath}
                  invalidText={errors?.nonCodedCauseOfDeath?.message}
                  labelText={t('nonCodedCauseOfDeath', 'Non-coded cause of death')}
                  onChange={onChange}
                  placeholder={t('enterNonCodedCauseOfDeath', 'Enter non-coded cause of death')}
                  value={value}
                />
              )}
            />
          </div>
        )}
      </div>
      <ButtonSet className={classNames({ [styles.tablet]: isTablet, [styles.desktop]: !isTablet })}>
        <Button className={styles.button} kind="secondary" onClick={() => void closeCurrentWorkspace()}>
          {t('discard', 'Discard')}
        </Button>
        <Button className={styles.button} disabled={isSubmitting} kind="primary" type="submit">
          {isSubmitting ? (
            <InlineLoading description={t('saving', 'Saving') + '...'} role="progressbar" />
          ) : (
            t('saveAndClose', 'Save and close')
          )}
        </Button>
      </ButtonSet>
    </Form>
  );

  if (isWorkspace2Props(props)) {
    return (
      <Workspace2 title={t('markPatientDeceased', 'Marcar paciente como fallecido')} hasUnsavedChanges={isDirty}>
        {content}
      </Workspace2>
    );
  }

  return content;
};

export default MarkPatientDeceasedForm;
