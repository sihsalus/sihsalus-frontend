import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import React, { type Dispatch, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'dayjs/plugin/utc';
import {
  ComboBox,
  FormGroup,
  FormLabel,
  InlineLoading,
  InlineNotification,
  Layer,
  RadioButton,
  RadioButtonGroup,
  Stack,
  TextArea,
  Tile,
} from '@carbon/react';
import {
  getUserFacingErrorMessage,
  OpenmrsDatePicker,
  ResponsiveWrapper,
  showSnackbar,
  useDebounce,
  useSession,
} from '@openmrs/esm-framework';
import {
  type AntecedentTypeCode,
  antecedentTypeOptions,
  CONDITION_TEXT_MAX_LENGTH,
  type ConditionFormSubmissionResult,
  getAntecedentTypeLabel,
  isConditionForPatient,
  isUnconfirmedConditionWriteError,
  matchesConditionStatusFilter,
} from '@openmrs/esm-patient-common-lib';
import { Controller, useFormContext } from 'react-hook-form';
import {
  type CodedCondition,
  type Condition,
  createCondition,
  type FormFields,
  syncConditionCache,
  updateCondition,
  useConditions,
  useConditionsSearch,
} from './conditions.resource';
import { getConditionDestination } from './conditions-categories';
import styles from './conditions-form.scss';
import { type ConditionsFormSchema } from './conditions-form.workspace';

export interface ConditionsWidgetHandle {
  submit: () => Promise<ConditionFormSubmissionResult>;
}

interface ConditionsWidgetProps {
  closeWorkspaceWithSavedChanges?: () => void;
  conditionToEdit?: Condition;
  isEditing?: boolean;
  isSubmittingForm: boolean;
  patientUuid: string;
  setErrorCreating?: (error: Error) => void;
  setErrorUpdating?: (error: Error) => void;
  setHasSubmissibleValue?: (value: boolean) => void;
  setIsSubmittingForm: Dispatch<boolean>;
  lockedAntecedentType?: boolean;
  patientBirthDate?: string;
}

interface RequiredFieldLabelProps {
  label: string;
  t: TFunction;
}

function getConditionDestinationLabel(antecedentType: string | undefined, clinicalStatus: string, t: TFunction) {
  switch (getConditionDestination(antecedentType, clinicalStatus)) {
    case 'active-problems':
      return t('activeProblems', 'Active problems');
    case 'past-diagnoses':
      return t('pastDiagnoses', 'Past diagnoses');
    case 'other-antecedents':
    default:
      return t('antecedents', 'Antecedents');
  }
}

const ConditionsWidget = React.forwardRef<ConditionsWidgetHandle, ConditionsWidgetProps>(
  (
    {
      closeWorkspaceWithSavedChanges,
      conditionToEdit,
      isEditing,
      isSubmittingForm,
      patientUuid,
      setErrorCreating,
      setErrorUpdating,
      setIsSubmittingForm,
      lockedAntecedentType,
      patientBirthDate,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const inputId = useId();
    const mounted = useRef(true);
    useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
      };
    }, []);
    const { conditions, mutate } = useConditions(patientUuid);
    const {
      control,
      formState: { errors, dirtyFields },
      getValues,
      setValue,
      watch,
    } = useFormContext<ConditionsFormSchema>();
    const session = useSession();
    const clinicalStatus = watch('clinicalStatus');
    const antecedentType = watch('antecedentType');
    const matchingCondition = conditions?.find((condition) => condition?.id === conditionToEdit?.id);
    const editableCondition = conditionToEdit;

    const editableConditionId = editableCondition?.id;
    const editableConceptId = editableCondition?.conceptId;
    const displayName = editableCondition?.display;
    const editableClinicalStatus = editableCondition?.clinicalStatus;
    const [selectedCondition, setSelectedCondition] = useState<CodedCondition>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm);
    const { searchResults, isSearching, error: searchError } = useConditionsSearch(debouncedSearchTerm);

    const handleConditionChange = useCallback((selectedCondition: CodedCondition | null) => {
      setSelectedCondition(selectedCondition);
    }, []);

    const refreshAfterSave = useCallback(async () => {
      try {
        await syncConditionCache(mutate);
        return true;
      } catch {
        return false;
      }
    }, [mutate]);

    const handleCreate = useCallback(async () => {
      const narrative =
        getValues('antecedentType') !== 'definitive-diagnosis' ? getValues('nonCodedText')?.trim() : undefined;
      if ((!selectedCondition || searchError) && !narrative) {
        setIsSubmittingForm(false);
        return false;
      }

      const providerUuid = session?.currentProvider?.uuid;
      if (!providerUuid) {
        setIsSubmittingForm(false);
        setErrorCreating?.(
          new Error(
            t(
              'clinicalProviderRequiredForAntecedent',
              'Your session is not linked to a clinical provider. Sign in with a clinical account and try again.',
            ),
          ),
        );
        return false;
      }

      const selectedClinicalStatus = getValues('clinicalStatus');

      const payload: FormFields = {
        clinicalStatus: selectedClinicalStatus,
        conceptId: narrative ? '' : selectedCondition?.uuid,
        nonCodedText: narrative,
        display: narrative ?? selectedCondition?.display,
        abatementDateTime: dirtyFields.abatementDateTime
          ? getValues('abatementDateTime')
            ? dayjs(getValues('abatementDateTime')).format()
            : null
          : undefined,
        onsetDateTime: dirtyFields.onsetDateTime
          ? getValues('onsetDateTime')
            ? dayjs(getValues('onsetDateTime')).format()
            : null
          : undefined,
        patientId: patientUuid,
        providerUuid,
        antecedentType: getValues('antecedentType') as AntecedentTypeCode,
      };

      let writeConfirmed = false;
      try {
        await createCondition(payload);
        writeConfirmed = true;
        const refreshed = await refreshAfterSave();

        if (!mounted.current) return true;
        showSnackbar({
          kind: refreshed ? 'success' : 'warning',
          subtitle: !refreshed
            ? t('antecedentSavedRefreshFailed', 'Saved. Reload the history to see the latest information.')
            : t('antecedentNowVisible', 'It is now visible in {{section}}', {
                section: getConditionDestinationLabel(payload.antecedentType, payload.clinicalStatus, t),
              }),
          title: t('antecedentSaved', 'Antecedent saved'),
        });

        await closeWorkspaceWithSavedChanges();
        return true;
      } catch (error) {
        if (writeConfirmed) return true;
        if (!mounted.current) return false;
        if (isUnconfirmedConditionWriteError(error)) {
          setErrorCreating?.(
            new Error(
              t(
                'antecedentSaveUnconfirmedMessage',
                'The save could not be confirmed. Close this form and reload the history before recording it again.',
              ),
            ),
          );
          return 'uncertain' as const;
        }
        setIsSubmittingForm(false);
        setErrorCreating?.(
          new Error(
            getUserFacingErrorMessage(
              error,
              t('antecedentSaveFailed', 'The antecedent could not be saved. Please try again.'),
              {
                logContext: 'Save antecedent',
                codeMessages: {
                  CONDITION_CODED_DIAGNOSIS_REQUIRED: t(
                    'antecedentCodedDiagnosisRequired',
                    'A definitive diagnosis requires a coded concept.',
                  ),
                  CONDITION_TEXT_TOO_LONG: t(
                    'antecedentTextTooLong',
                    'Shorten the antecedent description or note before saving.',
                  ),
                },
              },
            ),
          ),
        );
        return false;
      }
    }, [
      dirtyFields,
      closeWorkspaceWithSavedChanges,
      getValues,
      refreshAfterSave,
      patientUuid,
      selectedCondition,
      searchError,
      session?.currentProvider?.uuid,
      setErrorCreating,
      setIsSubmittingForm,
      t,
    ]);

    const handleUpdate = useCallback(async () => {
      const providerUuid = session?.currentProvider?.uuid;
      if (!providerUuid) {
        setIsSubmittingForm(false);
        setErrorUpdating?.(
          new Error(
            t(
              'clinicalProviderRequiredForAntecedent',
              'Your session is not linked to a clinical provider. Sign in with a clinical account and try again.',
            ),
          ),
        );
        return false;
      }

      if (
        !isConditionForPatient(matchingCondition?.source, patientUuid) ||
        !(conditionToEdit?.conceptId || conditionToEdit?.nonCodedText)
      ) {
        setIsSubmittingForm(false);
        setErrorUpdating?.(
          new Error(
            t('antecedentDataUnavailable', 'The antecedent data could not be loaded. Reopen it and try again.'),
          ),
        );
        return false;
      }

      const selectedClinicalStatus = dirtyFields.clinicalStatus
        ? getValues('clinicalStatus')
        : editableClinicalStatus?.toLowerCase();
      const payload: FormFields = {
        clinicalStatus: selectedClinicalStatus,
        conceptId: editableConceptId,
        display: displayName,
        abatementDateTime: dirtyFields.abatementDateTime
          ? getValues('abatementDateTime')
            ? dayjs(getValues('abatementDateTime')).format()
            : null
          : undefined,
        onsetDateTime: dirtyFields.onsetDateTime
          ? getValues('onsetDateTime')
            ? dayjs(getValues('onsetDateTime')).format()
            : null
          : undefined,
        patientId: patientUuid,
        originalCondition: conditionToEdit.source,
        providerUuid,
        antecedentType: dirtyFields.antecedentType ? (getValues('antecedentType') as AntecedentTypeCode) : undefined,
      };

      let writeConfirmed = false;
      try {
        await updateCondition(editableConditionId, payload);
        writeConfirmed = true;
        const refreshed = await refreshAfterSave();

        if (!mounted.current) return true;
        showSnackbar({
          kind: refreshed ? 'success' : 'warning',
          subtitle: !refreshed
            ? t('antecedentSavedRefreshFailed', 'Saved. Reload the history to see the latest information.')
            : t('antecedentNowVisible', 'It is now visible in {{section}}', {
                section: getConditionDestinationLabel(
                  payload.antecedentType ?? conditionToEdit.antecedentType,
                  payload.clinicalStatus,
                  t,
                ),
              }),
          title: t('antecedentUpdated', 'Antecedent updated'),
        });

        await closeWorkspaceWithSavedChanges();
        return true;
      } catch (error) {
        if (writeConfirmed) return true;
        if (!mounted.current) return false;
        if (isUnconfirmedConditionWriteError(error)) {
          setErrorUpdating?.(
            new Error(
              t(
                'antecedentSaveUnconfirmedMessage',
                'The save could not be confirmed. Close this form and reload the history before recording it again.',
              ),
            ),
          );
          return 'uncertain' as const;
        }
        setIsSubmittingForm(false);
        setErrorUpdating?.(
          new Error(
            getUserFacingErrorMessage(
              error,
              t('antecedentSaveFailed', 'The antecedent could not be saved. Please try again.'),
              {
                logContext: 'Save antecedent',
                codeMessages: {
                  CONDITION_CODED_DIAGNOSIS_REQUIRED: t(
                    'antecedentCodedDiagnosisRequired',
                    'A definitive diagnosis requires a coded concept.',
                  ),
                  CONDITION_TEXT_TOO_LONG: t(
                    'antecedentTextTooLong',
                    'Shorten the antecedent description or note before saving.',
                  ),
                  CONDITION_CHANGED: t(
                    'antecedentChanged',
                    'This antecedent changed. Close this form and reopen it before editing.',
                  ),
                },
              },
            ),
          ),
        );
        return false;
      }
    }, [
      dirtyFields,
      matchingCondition,
      conditionToEdit,
      closeWorkspaceWithSavedChanges,
      displayName,
      editableClinicalStatus,
      editableConceptId,
      editableConditionId,
      getValues,
      refreshAfterSave,
      patientUuid,
      session?.currentProvider?.uuid,
      setErrorUpdating,
      setIsSubmittingForm,
      t,
    ]);

    const handleSearchTermChange = (searchTerm: string) => {
      setSearchTerm(searchTerm);
    };

    useImperativeHandle(
      ref,
      () => ({
        submit: () => (isEditing ? handleUpdate() : handleCreate()),
      }),
      [isEditing, handleCreate, handleUpdate],
    );

    return (
      <fieldset
        className={styles.formContainer}
        disabled={isSubmittingForm}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        {isEditing &&
          [conditionToEdit?.onsetDateTime, conditionToEdit?.abatementDateTime].some(
            (date) => date && !/^\d{4}-\d{2}-\d{2}/.test(date),
          ) && (
            <p>
              {t('antecedentPartialDatesPreserved', 'Partial recorded dates are kept unchanged:')}{' '}
              {[conditionToEdit?.onsetDateTime, conditionToEdit?.abatementDateTime]
                .filter((date) => date && !/^\d{4}-\d{2}-\d{2}/.test(date))
                .join(' · ')}
            </p>
          )}
        {!isEditing && searchError ? (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            role="alert"
            title={t('antecedentSearchFailed', 'Antecedent search is unavailable. Please try again.')}
          />
        ) : null}
        <Stack gap={7}>
          <FormGroup legendText={<RequiredFieldLabel label={t('antecedentType', 'Antecedent type')} t={t} />}>
            <Controller
              name="antecedentType"
              control={control}
              render={({ field: { onChange, value, onBlur } }) => (
                <RadioButtonGroup
                  className={styles.radioGroup}
                  invalid={Boolean(errors?.antecedentType)}
                  name="antecedentType"
                  onBlur={onBlur}
                  onChange={onChange}
                  orientation="vertical"
                  valueSelected={value ?? ''}
                  aria-labelledby={errors?.antecedentType ? `${inputId}-antecedentTypeError` : undefined}
                >
                  {antecedentTypeOptions.map((option) => (
                    <RadioButton
                      key={option.code}
                      id={`${inputId}-antecedent-type-${option.code}`}
                      labelText={getAntecedentTypeLabel(option.code, t)}
                      value={option.code}
                      disabled={lockedAntecedentType}
                    />
                  ))}
                </RadioButtonGroup>
              )}
            />
            {errors?.antecedentType && (
              <p id={`${inputId}-antecedentTypeError`} className={styles.errorMessage}>
                {errors.antecedentType.message}
              </p>
            )}
          </FormGroup>
          {!isEditing && antecedentType && antecedentType !== 'definitive-diagnosis' && (
            <Controller
              name="nonCodedText"
              control={control}
              render={({ field }) => (
                <TextArea
                  {...field}
                  disabled={Boolean(selectedCondition)}
                  id={`${inputId}-nonCodedText`}
                  labelText={t('nonCodedAntecedent', 'Non-coded antecedent')}
                  maxLength={CONDITION_TEXT_MAX_LENGTH}
                  invalid={Boolean(errors.nonCodedText)}
                  invalidText={errors.nonCodedText?.message}
                  helperText={t(
                    'nonCodedAntecedentHelp',
                    'Describe the antecedent when no suitable coded concept is available.',
                  )}
                  onChange={(event) => {
                    field.onChange(event);
                    if (event.target.value.trim()) {
                      setSelectedCondition(null);
                      setSearchTerm('');
                      setValue('conditionName', '');
                    }
                  }}
                />
              )}
            />
          )}
          <FormGroup legendText={isEditing ? <RequiredFieldLabel label={t('antecedent', 'Antecedent')} t={t} /> : ''}>
            {isEditing ? (
              <FormLabel className={styles.conditionLabel}>{displayName}</FormLabel>
            ) : (
              <>
                <Controller
                  name="conditionName"
                  control={control}
                  render={({ field: { onChange } }) => (
                    <ResponsiveWrapper>
                      <ComboBox<CodedCondition>
                        allowCustomValue={false}
                        autoAlign
                        disabled={Boolean(watch('nonCodedText')?.trim()) && antecedentType !== 'definitive-diagnosis'}
                        id={`${inputId}-conditionsSearch`}
                        invalid={Boolean(errors?.conditionName)}
                        invalidText={errors?.conditionName?.message}
                        items={searchResults ?? []}
                        itemToString={(item) => item?.display ?? ''}
                        onChange={({ selectedItem }) => {
                          const condition = selectedItem ?? null;
                          handleConditionChange(condition);
                          onChange(condition?.display ?? '');
                          setSearchTerm(condition?.display ?? '');
                          if (condition) setValue('nonCodedText', '');
                        }}
                        onInputChange={(inputValue) => {
                          handleSearchTermChange(inputValue);
                          if (selectedCondition && inputValue !== selectedCondition.display) {
                            setSelectedCondition(null);
                            onChange('');
                          }
                        }}
                        placeholder={t('searchAntecedents', 'Search antecedents')}
                        selectedItem={selectedCondition}
                        shouldFilterItem={() => true}
                        titleText={
                          antecedentType && antecedentType !== 'definitive-diagnosis' ? (
                            t('codedAntecedent', 'Coded antecedent')
                          ) : (
                            <RequiredFieldLabel label={t('antecedent', 'Antecedent')} t={t} />
                          )
                        }
                      />
                    </ResponsiveWrapper>
                  )}
                />
                {isSearching ? (
                  <InlineLoading className={styles.loader} description={t('searching', 'Searching') + '...'} />
                ) : null}
                {!searchError && !isSearching && searchTerm && !selectedCondition && !searchResults?.length ? (
                  <Layer>
                    <Tile className={styles.emptyResults}>
                      <span>
                        {t('noResultsFor', 'No results for')} <strong>"{searchTerm}"</strong>
                      </span>
                    </Tile>
                  </Layer>
                ) : null}
              </>
            )}
          </FormGroup>
          <FormGroup legendText="">
            <Controller
              name="onsetDateTime"
              control={control}
              render={({ field, fieldState }) => (
                <ResponsiveWrapper>
                  <OpenmrsDatePicker
                    {...field}
                    id={`${inputId}-onsetDate`}
                    isDisabled={Boolean(
                      isEditing &&
                        conditionToEdit?.onsetDateTime &&
                        !/^\d{4}-\d{2}-\d{2}/.test(conditionToEdit.onsetDateTime),
                    )}
                    data-testid={`${inputId}-onsetDate`}
                    minDate={
                      antecedentType !== 'family' && patientBirthDate
                        ? dayjs(patientBirthDate).startOf('day').toDate()
                        : undefined
                    }
                    maxDate={new Date()}
                    labelText={t('onsetDate', 'Onset date')}
                    invalid={Boolean(fieldState?.error?.message)}
                    invalidText={fieldState?.error?.message}
                  />
                </ResponsiveWrapper>
              )}
            />
          </FormGroup>
          {isEditing &&
            conditionToEdit?.clinicalStatus &&
            !['active', 'inactive'].includes(conditionToEdit.clinicalStatus.toLowerCase()) && (
              <p>
                {t('recordedClinicalStatus', 'Recorded clinical status')}:{' '}
                {t(conditionToEdit.clinicalStatus.toLowerCase(), conditionToEdit.clinicalStatus)}
              </p>
            )}
          <FormGroup legendText={<RequiredFieldLabel label={t('clinicalStatus', 'Clinical status')} t={t} />}>
            <Controller
              name="clinicalStatus"
              control={control}
              render={({ field: { onChange, value, onBlur } }) => (
                <RadioButtonGroup
                  className={styles.radioGroup}
                  invalid={Boolean(errors?.clinicalStatus)}
                  name="clinicalStatus"
                  onBlur={onBlur}
                  onChange={onChange}
                  orientation="vertical"
                  valueSelected={value.toLowerCase()}
                  aria-labelledby={errors?.clinicalStatus ? `${inputId}-clinicalStatusError` : undefined}
                >
                  <RadioButton id={`${inputId}-active`} labelText={t('active', 'Active')} value="active" />
                  <RadioButton id={`${inputId}-inactive`} labelText={t('inactive', 'Inactive')} value="inactive" />
                </RadioButtonGroup>
              )}
            />
            {errors?.clinicalStatus && (
              <p id={`${inputId}-clinicalStatusError`} className={styles.errorMessage}>
                {errors.clinicalStatus.message}
              </p>
            )}
          </FormGroup>
          {matchesConditionStatusFilter(clinicalStatus, 'Inactive') && (
            <FormGroup legendText="">
              <Controller
                name="abatementDateTime"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <ResponsiveWrapper>
                      <OpenmrsDatePicker
                        {...field}
                        id={`${inputId}-endDate`}
                        isDisabled={Boolean(
                          isEditing &&
                            conditionToEdit?.abatementDateTime &&
                            !/^\d{4}-\d{2}-\d{2}/.test(conditionToEdit.abatementDateTime),
                        )}
                        data-testid={`${inputId}-endDate`}
                        minDate={watch('onsetDateTime') ? new Date(watch('onsetDateTime')) : undefined}
                        maxDate={new Date()}
                        labelText={t('endDate', 'End date')}
                        invalid={Boolean(fieldState?.error?.message)}
                        invalidText={fieldState?.error?.message}
                      />
                    </ResponsiveWrapper>
                  </>
                )}
              />
            </FormGroup>
          )}
        </Stack>
      </fieldset>
    );
  },
);

function RequiredFieldLabel({ label, t }: RequiredFieldLabelProps) {
  return (
    <span>
      {label}
      <span title={t('required', 'Required')} className={styles.required}>
        *
      </span>
    </span>
  );
}

export default ConditionsWidget;
