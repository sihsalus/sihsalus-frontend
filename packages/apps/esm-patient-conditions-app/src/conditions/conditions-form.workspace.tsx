import { Button, ButtonSet, Form, InlineLoading, InlineNotification } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLayoutType, usePatient, Workspace2 } from '@openmrs/esm-framework';
import type { AntecedentTypeCode } from '@openmrs/esm-patient-common-lib';
import {
  type DefaultPatientWorkspaceProps,
  type PatientWorkspace2DefinitionProps,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import React, { useCallback, useState } from 'react';
import { FormProvider, type SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { type Condition, useConditions } from './conditions.resource';
import styles from './conditions-form.scss';
import ConditionsWidget from './conditions-widget.component';

export interface ConditionFormProps {
  condition?: Condition;
  defaultAntecedentType?: AntecedentTypeCode;
  defaultClinicalStatus?: 'active' | 'inactive';
  formContext: 'creating' | 'editing';
  lockedAntecedentType?: boolean;
  workspaceTitle?: string;
}

export const createSchema = (formContext: 'creating' | 'editing', t: TFunction, patientBirthDate?: string) => {
  const isCreating = formContext === 'creating';

  const clinicalStatusValidation = z.string().refine((clinicalStatus) => !isCreating || !!clinicalStatus, {
    message: t('clinicalStatusRequired', 'A clinical status is required'),
  });

  const conditionNameValidation = z.string().refine((conditionName) => !isCreating || !!conditionName, {
    message: t('antecedentRequired', 'An antecedent is required'),
  });

  const antecedentTypeValidation = z.string().refine((antecedentType) => !!antecedentType, {
    message: t('antecedentTypeRequired', 'An antecedent type is required'),
  });

  return z.object({
    abatementDateTime: z.date().optional().nullable(),
    antecedentType: antecedentTypeValidation,
    clinicalStatus: clinicalStatusValidation,
    conditionName: conditionNameValidation,
    onsetDateTime: z
      .date()
      .nullable()
      .refine(
        (onsetDateTime) =>
          !onsetDateTime ||
          !patientBirthDate ||
          !dayjs(onsetDateTime).startOf('day').isBefore(dayjs(patientBirthDate).startOf('day')),
        {
          message: t(
            'onsetDateCannotBeBeforeBirthDate',
            "Onset date cannot be earlier than the patient's birth date",
          ),
        },
      )
      .refine((onsetDateTime) => !onsetDateTime || !dayjs(onsetDateTime).startOf('day').isAfter(dayjs().startOf('day')), {
        message: t('onsetDateCannotBeInTheFuture', 'Onset date cannot be in the future'),
      }),
  });
};

export type ConditionsFormSchema = z.infer<ReturnType<typeof createSchema>>;

type ConditionsWorkspaceDefinitionProps = PatientWorkspace2DefinitionProps<ConditionFormProps, {}>;
type LegacyConditionsWorkspaceProps = DefaultPatientWorkspaceProps & ConditionFormProps;
type ConditionsWorkspaceProps = ConditionsWorkspaceDefinitionProps | LegacyConditionsWorkspaceProps;

function isWorkspace2Props(props: ConditionsWorkspaceProps): props is ConditionsWorkspaceDefinitionProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

const ConditionsForm: React.FC<ConditionsWorkspaceProps> = (props) => {
  const closeWorkspace = props.closeWorkspace;
  const patientUuid = isWorkspace2Props(props) ? props.groupProps.patientUuid : props.patientUuid;
  const patientFromGroup = isWorkspace2Props(props) ? props.groupProps.patient : null;
  const condition = isWorkspace2Props(props) ? props.workspaceProps.condition : props.condition;
  const formContext = (isWorkspace2Props(props) ? props.workspaceProps.formContext : props.formContext) ?? 'creating';
  const defaultAntecedentType = isWorkspace2Props(props)
    ? props.workspaceProps.defaultAntecedentType
    : props.defaultAntecedentType;
  const defaultClinicalStatus = isWorkspace2Props(props)
    ? props.workspaceProps.defaultClinicalStatus
    : props.defaultClinicalStatus;
  const lockedAntecedentType = isWorkspace2Props(props)
    ? props.workspaceProps.lockedAntecedentType
    : props.lockedAntecedentType;
  const workspaceTitle = isWorkspace2Props(props) ? props.workspaceProps.workspaceTitle : props.workspaceTitle;
  const { t } = useTranslation();
  const { patient: fetchedPatient } = usePatient(patientUuid);
  const patient = patientFromGroup ?? fetchedPatient;
  const isTablet = useLayoutType() === 'tablet';
  const { conditions } = useConditions(patientUuid);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [errorCreating, setErrorCreating] = useState(null);
  const [errorUpdating, setErrorUpdating] = useState(null);
  const isEditing = formContext === 'editing';

  const matchingCondition = conditions?.find((c) => c?.id === condition?.id);
  const editableCondition = matchingCondition ?? condition;

  const schema = createSchema(formContext, t, patient?.birthDate);

  const defaultValues = {
    abatementDateTime:
      isEditing && editableCondition?.abatementDateTime ? new Date(editableCondition.abatementDateTime) : null,
    antecedentType: isEditing ? (editableCondition?.antecedentType ?? '') : (defaultAntecedentType ?? ''),
    conditionName: '',
    clinicalStatus: isEditing
      ? (editableCondition?.clinicalStatus?.toLowerCase() ?? '')
      : (defaultClinicalStatus ?? ''),
    onsetDateTime: isEditing && editableCondition?.onsetDateTime ? new Date(editableCondition.onsetDateTime) : null,
  };

  const methods = useForm<ConditionsFormSchema>({
    mode: 'all',
    resolver: zodResolver(schema),
    defaultValues,
  });

  const {
    formState: { isDirty },
  } = methods;

  const onSubmit: SubmitHandler<ConditionsFormSchema> = () => {
    setIsSubmittingForm(true);
  };

  const onError = () => setIsSubmittingForm(false);

  const closeWorkspaceWithSavedChanges = useCallback(() => {
    closeWorkspace({ discardUnsavedChanges: true });
  }, [closeWorkspace]);

  const form = (
    <>
      <FormProvider {...methods}>
        <Form className={styles.form} onSubmit={methods.handleSubmit(onSubmit, onError)}>
          <ConditionsWidget
            closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
            conditionToEdit={condition}
            isEditing={isEditing}
            isSubmittingForm={isSubmittingForm}
            patientUuid={patientUuid}
            setErrorCreating={setErrorCreating}
            setErrorUpdating={setErrorUpdating}
            setIsSubmittingForm={setIsSubmittingForm}
            lockedAntecedentType={lockedAntecedentType}
            patientBirthDate={patient?.birthDate}
          />
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
    </>
  );

  if (isWorkspace2Props(props)) {
    return (
      <Workspace2 title={workspaceTitle ?? t('recordAntecedent', 'Record antecedent')} hasUnsavedChanges={isDirty}>
        {form}
      </Workspace2>
    );
  }

  return form;
};

export default ConditionsForm;
