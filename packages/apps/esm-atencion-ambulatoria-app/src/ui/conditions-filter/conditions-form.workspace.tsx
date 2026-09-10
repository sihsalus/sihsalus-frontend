import {
  Button,
  ButtonSet,
  DataTableSkeleton,
  Form,
  FormGroup,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  TextArea,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { launchWorkspace, useConfig, useLayoutType } from '@openmrs/esm-framework';
import {
  type AntecedentTypeCode,
  antecedentTypeOptions,
  CONDITION_TEXT_MAX_LENGTH,
  type DefaultPatientWorkspaceProps,
  getAntecedentTypeLabel,
  getConditionNoteMaxLength,
  isActiveConditionStatus,
  isConditionForPatient,
  isSupportedConditionStatus,
  launchPatientWorkspace,
  normalizeAntecedentTypeCode,
  useConditionFormLifecycle,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { Controller, FormProvider, type SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type { ConfigObject } from '../../config-schema';
import { patientFormEntryWorkspace } from '../../utils/constants';
import { type Condition, useConditions } from './conditions.resource';
import styles from './conditions-form.scss';
import ConditionsWidget from './conditions-widget.component';

interface ConditionFormProps extends DefaultPatientWorkspaceProps {
  condition?: Condition;
  formContext: 'creating' | 'editing';
  workspaceProps?: {
    conceptSetUuid?: string;
    title?: string;
  };
}

export const createSchema = (formContext: 'creating' | 'editing', t: TFunction, originalCondition?: Condition) => {
  const isCreating = formContext === 'creating';

  const antecedentScopeValidation = z.enum(['personal', 'family', 'social']);

  const personalCategoryValidation = z.string().optional();

  const conditionNameValidation = z.string().optional();

  return z
    .object({
      abatementDateTime: z.date().optional().nullable(),
      clinicalStatus: z.string(),
      conditionName: conditionNameValidation,
      onsetDateTime: z
        .date()
        .nullable()
        .refine((onsetDateTime) => onsetDateTime <= new Date(), {
          message: t('onsetDateCannotBeInTheFuture', 'Onset date cannot be in the future'),
        }),
      antecedentScope: antecedentScopeValidation,
      personalCategory: personalCategoryValidation,
      freeText: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (
        (data.abatementDateTime || originalCondition?.abatementDateTime) &&
        isActiveConditionStatus(data.clinicalStatus)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['clinicalStatus'],
          message: t(
            'antecedentActiveWithEndDate',
            'An active antecedent cannot have an end date. Review its clinical status and end date.',
          ),
        });
      }
      const descriptionChanged =
        isCreating || data.freeText !== (originalCondition?.nonCodedText ?? originalCondition?.noteText ?? '');
      const descriptionLimit = isCreating
        ? CONDITION_TEXT_MAX_LENGTH
        : getConditionNoteMaxLength(data.personalCategory);
      if (
        data.antecedentScope === 'personal' &&
        descriptionChanged &&
        (data.freeText?.trim().length ?? 0) > descriptionLimit
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['freeText'],
          message: t('antecedentTextTooLong', 'Shorten the antecedent description or note before saving.'),
        });
      }
      if (
        originalCondition?.onsetDateTime &&
        /^\d{4}-\d{2}-\d{2}/.test(originalCondition.onsetDateTime) &&
        !data.onsetDateTime
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['onsetDateTime'],
          message: t(
            'antecedentDateCannotBeRemoved',
            'A recorded date can be corrected but cannot be removed from this form.',
          ),
        });
      }
      if (
        originalCondition?.abatementDateTime &&
        /^\d{4}-\d{2}-\d{2}/.test(originalCondition.abatementDateTime) &&
        !data.abatementDateTime
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['abatementDateTime'],
          message: t(
            'antecedentDateCannotBeRemoved',
            'A recorded date can be corrected but cannot be removed from this form.',
          ),
        });
      }

      if (
        data.abatementDateTime &&
        (data.abatementDateTime > new Date() || (data.onsetDateTime && data.abatementDateTime < data.onsetDateTime))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['abatementDateTime'],
          message: t(
            'antecedentEndDateInvalid',
            'The end date must be on or after the onset date and cannot be in the future.',
          ),
        });
      }

      if (data.antecedentScope === 'personal' && !isSupportedConditionStatus(data.clinicalStatus)) {
        ctx.addIssue({
          path: ['clinicalStatus'],
          code: z.ZodIssueCode.custom,
          message: t('clinicalStatusRequired', 'A clinical status is required'),
        });
      }

      // Require condition name when creating a personal antecedent that is not free text.
      if (isCreating && data.antecedentScope === 'personal' && data.personalCategory !== 'other') {
        if (!data.conditionName) {
          ctx.addIssue({
            path: ['conditionName'],
            code: z.ZodIssueCode.custom,
            message: t('antecedentRequired', 'An antecedent is required'),
          });
        }
      }
      // Require personalCategory when scope is personal
      if (
        data.antecedentScope === 'personal' &&
        !antecedentTypeOptions.some((option) => option.code === data.personalCategory)
      ) {
        ctx.addIssue({
          path: ['personalCategory'],
          code: z.ZodIssueCode.custom,
          message: t('required', 'Required'),
        });
      }
      // Require freeText if category is other
      if (data.antecedentScope === 'personal' && data.personalCategory === 'other') {
        if (!data.freeText || data.freeText.trim().length === 0) {
          ctx.addIssue({
            path: ['freeText'],
            code: z.ZodIssueCode.custom,
            message: t('required', 'Required'),
          });
        }
      }
    });
};

export type ConditionsFormSchema = z.infer<ReturnType<typeof createSchema>>;

const ConditionsFormContent: React.FC<ConditionFormProps> = ({
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  condition,
  formContext,
  patientUuid,
  promptBeforeClosing,
  workspaceProps,
}) => {
  const { t } = useTranslation();
  const inputId = useId();
  const isTablet = useLayoutType() === 'tablet';
  const { conditions, isLoading, error: loadingError } = useConditions(patientUuid);
  const [errorCreating, setErrorCreating] = useState(null);
  const [errorUpdating, setErrorUpdating] = useState(null);
  const isEditing = formContext === 'editing';
  const config = useConfig<ConfigObject>();

  const matchingCondition = conditions?.find((c) => c?.id === condition?.id);

  const editedCategory = normalizeAntecedentTypeCode(
    matchingCondition?.antecedentType ?? matchingCondition?.categoryText,
  );
  const personalAntecedentTypes = antecedentTypeOptions.filter(
    (option) => !(['family', 'social'] as Array<AntecedentTypeCode>).includes(option.code),
  );

  const defaultValues: Partial<ConditionsFormSchema> = useMemo(
    () => ({
      abatementDateTime:
        isEditing &&
        matchingCondition?.abatementDateTime &&
        /^\d{4}-\d{2}-\d{2}/.test(matchingCondition.abatementDateTime)
          ? new Date(matchingCondition?.abatementDateTime)
          : null,
      conditionName: '',
      clinicalStatus: isEditing ? (matchingCondition?.clinicalStatus?.toLowerCase() ?? '') : '',
      onsetDateTime:
        isEditing && matchingCondition?.onsetDateTime && /^\d{4}-\d{2}-\d{2}/.test(matchingCondition.onsetDateTime)
          ? new Date(matchingCondition?.onsetDateTime)
          : null,
      antecedentScope: 'personal',
      personalCategory: isEditing ? editedCategory : undefined,
      freeText:
        isEditing && editedCategory === 'other'
          ? (matchingCondition?.nonCodedText ?? matchingCondition?.noteText ?? '')
          : '',
    }),
    [isEditing, matchingCondition, editedCategory],
  );

  const methods = useForm<ConditionsFormSchema>({
    mode: 'all',
    resolver: (values, context, options) =>
      zodResolver(createSchema(formContext, t, originalCondition ?? matchingCondition))(values, context, options),
    defaultValues,
  });

  const { widgetRef, isSubmittingForm, isSaved, isUncertain, originalCondition, setIsSubmittingForm, submitCondition } =
    useConditionFormLifecycle({
      patientUuid,
      isEditing,
      matchingCondition,
      defaultValues,
      reset: methods.reset,
      onStart: () => {
        setErrorCreating(null);
        setErrorUpdating(null);
      },
      onError: () => {
        setErrorCreating(new Error(t('antecedentSaveFailed', 'The antecedent could not be saved. Please try again.')));
      },
    });

  const {
    formState: { isDirty },
    watch,
  } = methods;

  const antecedentScope = watch('antecedentScope');
  const personalCategory = watch('personalCategory');

  useEffect(() => {
    promptBeforeClosing(() => isDirty && !isSaved && !isUncertain);
  }, [isDirty, isSaved, isUncertain, promptBeforeClosing]);

  const onSubmit: SubmitHandler<ConditionsFormSchema> = async (values) => {
    // Route based on antecedent scope
    if (values.antecedentScope === 'personal') {
      await submitCondition();
      return;
    }

    if (values.antecedentScope === 'family') {
      // Open family relationship form and close
      launchWorkspace('family-relationship-form', {
        workspaceTitle: t('familyRelationshipFormTitle', 'Family Relationship Form'),
        patientUuid,
      });
      closeWorkspace();
      return;
    }

    if (values.antecedentScope === 'social') {
      // Open social history clinical encounter form and close
      launchPatientWorkspace(patientFormEntryWorkspace, {
        workspaceTitle: t('socialHistory', 'Social History'),
        formInfo: {
          encounterUuid: '',
          formUuid: config?.formsList?.clinicalEncounterFormUuid,
          patientUuid,
          visitTypeUuid: '',
          visitUuid: '',
        },
      });
      closeWorkspace();
      return;
    }
  };

  const onError = () => setIsSubmittingForm(false);

  const unsupportedClinicalStatus =
    isEditing &&
    Boolean(originalCondition ?? matchingCondition) &&
    !isSupportedConditionStatus((originalCondition ?? matchingCondition)?.clinicalStatus);

  if (isEditing && isLoading && !isSubmittingForm && !isSaved && !isUncertain)
    return <DataTableSkeleton role="progressbar" />;
  if (
    unsupportedClinicalStatus ||
    !patientUuid ||
    (isEditing &&
      !isSubmittingForm &&
      !isSaved &&
      !isUncertain &&
      (loadingError ||
        !(matchingCondition?.conceptId || matchingCondition?.nonCodedText) ||
        !isConditionForPatient(matchingCondition?.source, patientUuid)))
  ) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        role="alert"
        title={
          unsupportedClinicalStatus
            ? t('antecedentStatusNotEditable', 'This historical clinical status cannot be edited from this form.')
            : t('antecedentDataUnavailable', 'The antecedent data could not be loaded. Reopen it and try again.')
        }
      />
    );
  }

  return (
    <FormProvider {...methods}>
      <Form className={styles.form} onSubmit={methods.handleSubmit(onSubmit, onError)}>
        <FormGroup
          disabled={isSubmittingForm || isSaved || isUncertain}
          legendText={t('antecedentScope', 'Ámbito del antecedente')}
        >
          <Controller
            name="antecedentScope"
            control={methods.control}
            render={({ field: { onChange, value } }) => (
              <RadioButtonGroup
                className={`${styles.radioGroup} ${styles.scopeRow}`}
                name="antecedentScope"
                orientation="horizontal"
                onChange={onChange}
                valueSelected={value}
              >
                <RadioButton id={`${inputId}-scope-personal`} labelText={t('personal', 'Personal')} value="personal" />
                <RadioButton id={`${inputId}-scope-family`} labelText={t('family', 'Familia')} value="family" />
                <RadioButton id={`${inputId}-scope-social`} labelText={t('social', 'Social')} value="social" />
              </RadioButtonGroup>
            )}
          />
        </FormGroup>

        {antecedentScope === 'personal' && (
          <FormGroup
            disabled={isSubmittingForm || isSaved || isUncertain}
            legendText={t('antecedentType', 'Tipo de antecedente')}
          >
            <Controller
              name="personalCategory"
              control={methods.control}
              render={({ field: { onChange, value } }) => (
                <RadioButtonGroup
                  className={`${styles.radioGroup} ${!isTablet ? styles.categoryGrid : ''}`}
                  name="personalCategory"
                  orientation={isTablet ? 'vertical' : 'horizontal'}
                  onChange={onChange}
                  valueSelected={value}
                >
                  {personalAntecedentTypes.map((option) => (
                    <RadioButton
                      key={option.code}
                      id={`${inputId}-cat-${option.code}`}
                      labelText={getAntecedentTypeLabel(option.code, t)}
                      value={option.code}
                    />
                  ))}
                </RadioButtonGroup>
              )}
            />
          </FormGroup>
        )}

        {antecedentScope === 'personal' && personalCategory === 'other' && (
          <FormGroup
            disabled={isSubmittingForm || isSaved || isUncertain}
            legendText={t('freeTextDescription', 'Descripción')}
          >
            <Controller
              name="freeText"
              control={methods.control}
              render={({ field, fieldState }) => (
                <TextArea
                  id={`${inputId}-freeText`}
                  {...field}
                  readOnly={isEditing && Boolean(originalCondition?.nonCodedText)}
                  maxLength={isEditing ? getConditionNoteMaxLength(personalCategory) : CONDITION_TEXT_MAX_LENGTH}
                  invalid={Boolean(fieldState?.error?.message)}
                  invalidText={fieldState?.error?.message}
                  labelText={t('freeTextDescription', 'Descripción')}
                />
              )}
            />
          </FormGroup>
        )}

        {antecedentScope === 'personal' && (
          <ConditionsWidget
            ref={widgetRef}
            closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
            conditionToEdit={originalCondition}
            isEditing={isEditing}
            isSubmittingForm={isSubmittingForm || isSaved || isUncertain}
            patientUuid={patientUuid}
            setErrorCreating={setErrorCreating}
            setErrorUpdating={setErrorUpdating}
            setIsSubmittingForm={setIsSubmittingForm}
            workspaceProps={workspaceProps}
          />
        )}
        <div>
          {errorCreating ? (
            <div className={styles.errorContainer}>
              <InlineNotification
                className={styles.error}
                role="alert"
                kind="error"
                lowContrast
                title={t('errorCreatingAntecedent', 'Error creating antecedent')}
                subtitle={errorCreating?.message}
              />
            </div>
          ) : null}
          {errorUpdating ? (
            <div className={styles.errorContainer}>
              <InlineNotification
                className={styles.error}
                role="alert"
                kind="error"
                lowContrast
                title={t('errorUpdatingAntecedent', 'Error updating antecedent')}
                subtitle={errorUpdating?.message}
              />
            </div>
          ) : null}
          <ButtonSet
            className={classNames({
              [styles.tablet]: isTablet,
              [styles.desktop]: !isTablet,
            })}
          >
            <Button
              className={styles.button}
              kind="secondary"
              disabled={isSubmittingForm}
              onClick={() => closeWorkspace()}
            >
              {t('cancel', 'Cancel')}
            </Button>
            <Button
              className={styles.button}
              disabled={isSubmittingForm || isSaved || isUncertain}
              kind="primary"
              type="submit"
            >
              {isUncertain ? (
                <span>{t('antecedentSaveUnconfirmed', 'Save unconfirmed')}</span>
              ) : isSaved ? (
                <span>{t('antecedentSaved', 'Antecedent saved')}</span>
              ) : isSubmittingForm ? (
                <InlineLoading className={styles.spinner} description={t('saving', 'Saving') + '...'} />
              ) : (
                <span>{t('saveAndClose', 'Save & close')}</span>
              )}
            </Button>
          </ButtonSet>
        </div>
      </Form>
    </FormProvider>
  );
};

const ConditionsForm: React.FC<ConditionFormProps> = (props) => {
  const patientUuid = props.patientUuid;
  const condition = props.condition;
  return <ConditionsFormContent key={`${patientUuid}:${condition?.id ?? 'new'}`} {...props} />;
};

export default ConditionsForm;
