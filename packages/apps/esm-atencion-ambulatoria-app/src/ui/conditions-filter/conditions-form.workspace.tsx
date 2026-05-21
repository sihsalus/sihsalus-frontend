import {
  Button,
  ButtonSet,
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
import { type DefaultPatientWorkspaceProps, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import React, { useEffect, useState } from 'react';
import { Controller, FormProvider, type SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type { ConfigObject } from '../../config-schema';
import { patientFormEntryWorkspace } from '../../utils/constants';
import { type ConditionDataTableRow, useConditions } from './conditions.resource';
import styles from './conditions-form.scss';
import ConditionsWidget from './conditions-widget.component';

interface ConditionFormProps extends DefaultPatientWorkspaceProps {
  condition?: ConditionDataTableRow;
  formContext: 'creating' | 'editing';
  workspaceProps?: {
    conceptSetUuid?: string;
    title?: string;
  };
}

const createSchema = (formContext: 'creating' | 'editing', t: TFunction) => {
  const isCreating = formContext === 'creating';

  const clinicalStatusValidation = z.string().refine((clinicalStatus) => !isCreating || !!clinicalStatus, {
    message: t('clinicalStatusRequired', 'A clinical status is required'),
  });

  const antecedentScopeValidation = z.enum(['personal', 'family', 'social']);

  const personalCategoryValidation = z
    .enum(['patologicos', 'diagnosticos', 'quirurgicos', 'hospitalizaciones', 'otros'])
    .optional();

  const conditionNameValidation = z.string().optional();

  return z
    .object({
      abatementDateTime: z.date().optional().nullable(),
      clinicalStatus: clinicalStatusValidation,
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
      // Require condition name when creating a personal antecedent that is not 'otros'
      if (isCreating && data.antecedentScope === 'personal' && data.personalCategory !== 'otros') {
        if (!data.conditionName) {
          ctx.addIssue({
            path: ['conditionName'],
            code: z.ZodIssueCode.custom,
            message: t('conditionRequired', 'A condition is required'),
          });
        }
      }
      // Require personalCategory when scope is personal
      if (data.antecedentScope === 'personal' && !data.personalCategory) {
        ctx.addIssue({ path: ['personalCategory'], code: z.ZodIssueCode.custom, message: t('required', 'Required') });
      }
      // Require freeText if category is otros
      if (data.antecedentScope === 'personal' && data.personalCategory === 'otros') {
        if (!data.freeText || data.freeText.trim().length === 0) {
          ctx.addIssue({ path: ['freeText'], code: z.ZodIssueCode.custom, message: t('required', 'Required') });
        }
      }
    });
};

export type ConditionsFormSchema = z.infer<ReturnType<typeof createSchema>>;

const ConditionsForm: React.FC<ConditionFormProps> = ({
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  condition,
  formContext,
  patientUuid,
  promptBeforeClosing,
  workspaceProps,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { conditions } = useConditions(patientUuid);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [errorCreating, setErrorCreating] = useState(null);
  const [errorUpdating, setErrorUpdating] = useState(null);
  const isEditing = formContext === 'editing';
  const config = useConfig<ConfigObject>();

  const matchingCondition = conditions?.find((c) => c?.id === condition?.id);

  const schema = createSchema(formContext, t);

  const editedCategory = (():
    | 'patologicos'
    | 'diagnosticos'
    | 'quirurgicos'
    | 'hospitalizaciones'
    | 'otros'
    | undefined => {
    const value = matchingCondition?.categoryText?.toLowerCase();
    if (!value) return undefined;
    if (
      value === 'patologicos' ||
      value === 'diagnosticos' ||
      value === 'quirurgicos' ||
      value === 'hospitalizaciones' ||
      value === 'otros'
    )
      return value;
    return undefined;
  })();

  const defaultValues: Partial<ConditionsFormSchema> = {
    abatementDateTime:
      isEditing && matchingCondition?.abatementDateTime ? new Date(matchingCondition?.abatementDateTime) : null,
    conditionName: '',
    clinicalStatus: isEditing ? (matchingCondition?.clinicalStatus?.toLowerCase() ?? '') : '',
    onsetDateTime: isEditing && matchingCondition?.onsetDateTime ? new Date(matchingCondition?.onsetDateTime) : null,
    antecedentScope: 'personal',
    personalCategory: isEditing ? editedCategory : undefined,
    freeText: isEditing && editedCategory === 'otros' ? (matchingCondition?.noteText ?? '') : '',
  };

  const methods = useForm<ConditionsFormSchema>({
    mode: 'all',
    resolver: zodResolver(schema),
    defaultValues,
  });

  const {
    formState: { isDirty },
    watch,
  } = methods;

  const antecedentScope = watch('antecedentScope');
  const personalCategory = watch('personalCategory');

  useEffect(() => {
    promptBeforeClosing(() => isDirty);
  }, [isDirty, promptBeforeClosing]);

  const onSubmit: SubmitHandler<ConditionsFormSchema> = (values) => {
    // Route based on antecedent scope
    if (values.antecedentScope === 'personal') {
      setIsSubmittingForm(true);
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
          encounterUuid: config?.clinicalEncounterUuid,
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

  return (
    <FormProvider {...methods}>
      <Form className={styles.form} onSubmit={methods.handleSubmit(onSubmit, onError)}>
        <FormGroup legendText={t('antecedentScope', 'Tipo de antecedente')}>
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
                <RadioButton id="scope-personal" labelText={t('personal', 'Personal')} value="personal" />
                <RadioButton id="scope-family" labelText={t('family', 'Familia')} value="family" />
                <RadioButton id="scope-social" labelText={t('social', 'Social')} value="social" />
              </RadioButtonGroup>
            )}
          />
        </FormGroup>

        {antecedentScope === 'personal' && (
          <FormGroup legendText={t('personalCategory', 'Categoría')}>
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
                  <RadioButton id="cat-patologicos" labelText={t('pathological', 'Patológicos')} value="patologicos" />
                  <RadioButton
                    id="cat-diagnosticos"
                    labelText={t('definitiveDiagnoses', 'Diagnósticos definitivos')}
                    value="diagnosticos"
                  />
                  <RadioButton id="cat-quirurgicos" labelText={t('surgical', 'Quirúrgicos')} value="quirurgicos" />
                  <RadioButton
                    id="cat-hospitalizaciones"
                    labelText={t('previousHospitalizations', 'Hospitalizaciones previas')}
                    value="hospitalizaciones"
                  />
                  <RadioButton id="cat-otros" labelText={t('othersSpecify', 'Otros (especificar)')} value="otros" />
                </RadioButtonGroup>
              )}
            />
          </FormGroup>
        )}

        {antecedentScope === 'personal' && personalCategory === 'otros' && (
          <FormGroup legendText={t('freeTextDescription', 'Descripción')}>
            <Controller
              name="freeText"
              control={methods.control}
              render={({ field, fieldState }) => (
                <TextArea
                  id="freeText"
                  {...field}
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
            closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
            conditionToEdit={condition}
            isEditing={isEditing}
            isSubmittingForm={isSubmittingForm}
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
                title={t('errorCreatingCondition', 'Error creating condition')}
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
                title={t('errorUpdatingCondition', 'Error updating condition')}
                subtitle={errorUpdating?.message}
              />
            </div>
          ) : null}
          <ButtonSet className={classNames({ [styles.tablet]: isTablet, [styles.desktop]: !isTablet })}>
            <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button className={styles.button} disabled={isSubmittingForm} kind="primary" type="submit">
              {isSubmittingForm ? (
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

export default ConditionsForm;
