import {
  FormGroup,
  FormLabel,
  InlineLoading,
  InlineNotification,
  Layer,
  RadioButton,
  RadioButtonGroup,
  Search,
  Stack,
  Tile,
} from '@carbon/react';
import { WarningFilled } from '@carbon/react/icons';
import {
  getUserFacingErrorMessage,
  OpenmrsDatePicker,
  ResponsiveWrapper,
  showSnackbar,
  useConfig,
  useDebounce,
  useSession,
} from '@openmrs/esm-framework';
import {
  type ConditionFormSubmissionResult,
  isConditionForPatient,
  isUnconfirmedConditionWriteError,
  matchesConditionStatusFilter,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import dayjs from 'dayjs';
import 'dayjs/plugin/utc';
import type { TFunction } from 'i18next';
import React, { type Dispatch, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../config-schema';
import { type DefaultPatientWorkspaceProps } from '../../types';
import {
  type CodedCondition,
  type Condition,
  createCondition,
  type FormFields,
  syncConditionCache,
  updateCondition,
  useConditions,
  useConditionsSearchFromConceptSet,
} from './conditions.resource';
import styles from './conditions-form.scss';
import { type ConditionsFormSchema } from './conditions-form.workspace';

export interface ConditionsWidgetHandle {
  submit: () => Promise<ConditionFormSubmissionResult>;
}

interface ConditionsWidgetProps {
  closeWorkspace?: DefaultPatientWorkspaceProps['closeWorkspace'];
  conditionToEdit?: Condition;
  isEditing?: boolean;
  isSubmittingForm: boolean;
  patientUuid: string;
  setErrorCreating?: (error: Error) => void;
  setErrorUpdating?: (error: Error) => void;
  setHasSubmissibleValue?: (value: boolean) => void;
  setIsSubmittingForm: Dispatch<boolean>;
  workspaceProps?: {
    conceptSetUuid?: string;
    title?: string;
  };
}

interface RequiredFieldLabelProps {
  label: string;
  t: TFunction;
}

interface SearchResultsProps {
  isSearching: boolean;
  onConditionChange: (condition: CodedCondition) => void;
  searchResults: CodedCondition[];
  selectedCondition: CodedCondition;
  t: TFunction;
  value: string;
}

const ConditionsWidget = React.forwardRef<ConditionsWidgetHandle, ConditionsWidgetProps>(
  (
    {
      closeWorkspace,
      conditionToEdit,
      isEditing,
      isSubmittingForm,
      patientUuid,
      setErrorCreating,
      setErrorUpdating,
      setIsSubmittingForm,
      workspaceProps,
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
    const config = useConfig<ConfigObject>();
    const { conditions, mutate } = useConditions(patientUuid);
    const {
      control,
      formState: { errors, dirtyFields },
      getValues,
      watch,
    } = useFormContext<ConditionsFormSchema>();
    const session = useSession();
    const searchInputRef = useRef(null);
    const clinicalStatus = watch('clinicalStatus');
    const matchingCondition = conditions?.find((condition) => condition?.id === conditionToEdit?.id);

    const displayName = conditionToEdit?.display;
    const editableClinicalStatus = conditionToEdit?.clinicalStatus;
    const editableRecordedDate = conditionToEdit?.recordedDate;
    const [selectedCondition, setSelectedCondition] = useState<CodedCondition>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm);

    // Get conceptSetUuid from workspace props or use default from config
    const conceptSetUuid =
      workspaceProps?.conceptSetUuid || config?.conditionConceptSets?.antecedentesPatologicos?.uuid;

    const {
      searchResults,
      isSearching,
      error: searchError,
    } = useConditionsSearchFromConceptSet(debouncedSearchTerm, conceptSetUuid);

    const handleConditionChange = useCallback((selectedCondition: CodedCondition) => {
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
      if (!selectedCondition || searchError) {
        setIsSubmittingForm(false);
        setErrorCreating?.(new Error(t('conditionSelectionRequired', 'Select a condition from the search results.')));
        return false;
      }

      const providerUuid = session?.currentProvider?.uuid;
      if (!providerUuid) {
        setIsSubmittingForm(false);
        setErrorCreating?.(
          new Error(
            t(
              'clinicalProviderRequiredForCondition',
              'Your session is not linked to a clinical provider. Sign in with a clinical account and try again.',
            ),
          ),
        );
        return false;
      }

      const payload: FormFields = {
        clinicalStatus: getValues('clinicalStatus'),
        conceptId: selectedCondition?.uuid,
        display: selectedCondition?.display,
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
            : t('conditionNowVisible', 'It is now visible on the Conditions page'),
          title: t('conditionSaved', 'Condition saved'),
        });

        await closeWorkspace({ discardUnsavedChanges: true });
        return true;
      } catch (error: unknown) {
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
              t('conditionSaveFailed', 'The condition could not be saved. Please try again.'),
              {
                logContext: 'Create maternal health condition',
                codeMessages: {
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
      closeWorkspace,
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
              'clinicalProviderRequiredForCondition',
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
        // Sin el antecedente resuelto el PUT saldría con conceptId/display
        // indefinidos y corrompería el registro clínico.
        setIsSubmittingForm(false);
        setErrorUpdating?.(
          new Error(
            t('conditionEditUnavailable', 'No se pudo cargar la condición a editar. Recargue e intente nuevamente.'),
          ),
        );
        return false;
      }

      const payload: FormFields = {
        clinicalStatus: dirtyFields.clinicalStatus
          ? getValues('clinicalStatus')
          : editableClinicalStatus?.toLowerCase(),
        conceptId: conditionToEdit?.conceptId,
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
        recordedDate: editableRecordedDate,
      };

      let writeConfirmed = false;
      try {
        await updateCondition(conditionToEdit.id, payload);
        writeConfirmed = true;
        const refreshed = await refreshAfterSave();

        if (!mounted.current) return true;
        showSnackbar({
          kind: refreshed ? 'success' : 'warning',
          subtitle: !refreshed
            ? t('antecedentSavedRefreshFailed', 'Saved. Reload the history to see the latest information.')
            : t('conditionNowVisible', 'It is now visible on the Conditions page'),
          title: t('conditionUpdated', 'Condition updated'),
        });

        await closeWorkspace({ discardUnsavedChanges: true });
        return true;
      } catch (error: unknown) {
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
              t('conditionUpdateFailed', 'The condition could not be updated. Please try again.'),
              {
                logContext: 'Update maternal health condition',
                codeMessages: {
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
      closeWorkspace,
      displayName,
      editableClinicalStatus,
      getValues,
      refreshAfterSave,
      patientUuid,
      session?.currentProvider?.uuid,
      setErrorUpdating,
      setIsSubmittingForm,
      t,
      editableRecordedDate,
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
          <FormGroup legendText={<RequiredFieldLabel label={t('condition', 'Condition')} t={t} />}>
            {isEditing ? (
              <FormLabel className={styles.conditionLabel}>{displayName}</FormLabel>
            ) : (
              <>
                <Controller
                  name="conditionName"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <ResponsiveWrapper>
                      <Search
                        autoFocus
                        className={classNames({
                          [styles.conditionsError]: errors?.conditionName,
                        })}
                        disabled={isEditing}
                        id={`${inputId}-conditionsSearch`}
                        aria-labelledby={errors?.conditionName ? `${inputId}-conditionsSearchError` : undefined}
                        labelText={t('enterCondition', 'Enter condition')}
                        onChange={(event) => {
                          const val = event.target.value;
                          onChange(val);
                          handleSearchTermChange(val);
                          setSelectedCondition(null);
                        }}
                        onClear={() => {
                          onChange('');
                          setSearchTerm('');
                          setSelectedCondition(null);
                        }}
                        placeholder={t('searchConditions', 'Search conditions')}
                        ref={searchInputRef}
                        renderIcon={errors?.conditionName && ((props) => <WarningFilled fill="red" {...props} />)}
                        value={selectedCondition?.display ?? value ?? ''}
                      />
                    </ResponsiveWrapper>
                  )}
                />
                {errors?.conditionName && (
                  <p id={`${inputId}-conditionsSearchError`} className={styles.errorMessage}>
                    {errors.conditionName.message}
                  </p>
                )}
                {!searchError && (
                  <SearchResults
                    isSearching={isSearching}
                    onConditionChange={handleConditionChange}
                    searchResults={searchResults}
                    selectedCondition={selectedCondition}
                    t={t}
                    value={searchTerm}
                  />
                )}
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
                        minDate={new Date(watch('onsetDateTime'))}
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

function SearchResults({
  isSearching,
  onConditionChange,
  searchResults,
  selectedCondition,
  t,
  value,
}: SearchResultsProps) {
  if (!value || selectedCondition) {
    return null;
  }

  if (isSearching) {
    return <InlineLoading className={styles.loader} description={t('searching', 'Searching') + '...'} />;
  }

  if (searchResults?.length > 0) {
    return (
      <ul className={styles.conditionsList}>
        {searchResults?.map((searchResult) => (
          <li key={searchResult?.uuid}>
            <button className={styles.condition} onClick={() => onConditionChange(searchResult)} type="button">
              {searchResult.display}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Layer>
      <Tile className={styles.emptyResults}>
        <span>
          {String(t('noResultsFor', 'No results for'))} <strong>"{value}"</strong>
        </span>
      </Tile>
    </Layer>
  );
}

export default ConditionsWidget;
