import { Button, ButtonSet, DataTableSkeleton, Form, InlineLoading, InlineNotification } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLayoutType, Workspace2 } from '@openmrs/esm-framework';
import {
  isActiveConditionStatus,
  isConditionForPatient,
  isSupportedConditionStatus,
  type PatientWorkspace2DefinitionProps,
  useConditionFormLifecycle,
} from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import React, { useMemo, useState } from 'react';
import { FormProvider, type SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { prenatalCareEditPrivilege } from '../../constants';
import { type DefaultPatientWorkspaceProps } from '../../types';
import { type Condition, useConditions } from './conditions.resource';
import styles from './conditions-form.scss';
import ConditionsWidget from './conditions-widget.component';

interface ConditionFormPayload {
  condition?: Condition;
  formContext: 'creating' | 'editing';
  conceptSetUuid?: string;
  title?: string;
  workspaceTitle?: string;
  patientUuid?: string;
}

type LegacyConditionFormProps = DefaultPatientWorkspaceProps & ConditionFormPayload;
type ConditionWorkspace2Props = PatientWorkspace2DefinitionProps<ConditionFormPayload>;
type ConditionFormProps = LegacyConditionFormProps | ConditionWorkspace2Props;

function isWorkspace2Props(props: ConditionFormProps): props is ConditionWorkspace2Props {
  return 'groupProps' in props && 'workspaceProps' in props;
}

export const createSchema = (formContext: 'creating' | 'editing', t: TFunction, originalCondition?: Condition) => {
  const isCreating = formContext === 'creating';

  const clinicalStatusValidation = z.string().refine((clinicalStatus) => isSupportedConditionStatus(clinicalStatus), {
    message: t('clinicalStatusRequired', 'A clinical status is required'),
  });

  const conditionNameValidation = z.string().refine((conditionName) => !isCreating || !!conditionName, {
    message: t('conditionRequired', 'A condition is required'),
  });

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
    });
};

export type ConditionsFormSchema = z.infer<ReturnType<typeof createSchema>>;

const ConditionsFormContent: React.FC<LegacyConditionFormProps & { workspace2?: boolean }> = ({
  closeWorkspace,
  condition,
  formContext,
  workspaceProps,
  workspace2 = false,
}) => {
  const patientUuid = workspaceProps?.patientUuid ?? '';
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { conditions, isLoading, error: loadingError } = useConditions(patientUuid);
  const [errorCreating, setErrorCreating] = useState<Error | null>(null);
  const [errorUpdating, setErrorUpdating] = useState<Error | null>(null);
  const isEditing = formContext === 'editing';

  const matchingCondition = conditions?.find((c) => c?.id === condition?.id);

  const defaultValues = useMemo(
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
    }),
    [isEditing, matchingCondition],
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

  const onSubmit: SubmitHandler<ConditionsFormSchema> = submitCondition;

  const onError = () => setIsSubmittingForm(false);

  const unsupportedClinicalStatus =
    isEditing &&
    Boolean(originalCondition ?? matchingCondition) &&
    !isSupportedConditionStatus((originalCondition ?? matchingCondition)?.clinicalStatus);

  const renderWorkspace = (children: React.ReactNode) =>
    workspace2 ? (
      <Workspace2
        title={
          typeof workspaceProps?.workspaceTitle === 'string'
            ? workspaceProps.workspaceTitle
            : (workspaceProps?.title ?? t('recordCondition', 'Record condition'))
        }
        hasUnsavedChanges={methods.formState.isDirty && !isSaved && !isUncertain}
      >
        {children}
      </Workspace2>
    ) : (
      children
    );

  if (isEditing && isLoading && !isSubmittingForm && !isSaved && !isUncertain)
    return renderWorkspace(<DataTableSkeleton role="progressbar" />);
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
    return renderWorkspace(
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
      />,
    );
  }

  return renderWorkspace(
    <RequirePrivilege privilege={prenatalCareEditPrivilege}>
      <FormProvider {...methods}>
        <Form className={styles.form} onSubmit={methods.handleSubmit(onSubmit, onError)}>
          <ConditionsWidget
            ref={widgetRef}
            closeWorkspace={closeWorkspace}
            conditionToEdit={originalCondition}
            isEditing={isEditing}
            isSubmittingForm={isSubmittingForm || isSaved || isUncertain}
            patientUuid={patientUuid}
            setErrorCreating={setErrorCreating}
            setErrorUpdating={setErrorUpdating}
            setIsSubmittingForm={setIsSubmittingForm}
            workspaceProps={workspaceProps}
          />
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
                  <InlineLoading className={styles.spinner} description={t('saving', 'Saving...')} />
                ) : (
                  <span>{t('saveAndClose', 'Save and close')}</span>
                )}
              </Button>
            </ButtonSet>
          </div>
        </Form>
      </FormProvider>
    </RequirePrivilege>,
  );
};

const ConditionsForm: React.FC<ConditionFormProps> = (props) => {
  const workspace2 = isWorkspace2Props(props);
  const payload = workspace2 ? props.workspaceProps : props;
  const groupPatientUuid = workspace2 ? props.groupProps?.patientUuid : undefined;
  const patientUuid = workspace2
    ? (groupPatientUuid ?? '')
    : (props.workspaceProps?.patientUuid ?? props.patientUuid ?? '');
  const contextMismatch =
    workspace2 &&
    ((props.groupProps?.patient && props.groupProps.patient.id !== patientUuid) ||
      (props.workspaceProps?.patientUuid && props.workspaceProps.patientUuid !== patientUuid));
  const condition = payload?.condition;
  return (
    <ConditionsFormContent
      {...props}
      key={`${patientUuid}:${condition?.id ?? 'new'}`}
      condition={condition}
      formContext={payload?.formContext ?? 'creating'}
      workspace2={workspace2}
      workspaceProps={{ ...props.workspaceProps, patientUuid: contextMismatch ? '' : patientUuid }}
    />
  );
};

export default ConditionsForm;
