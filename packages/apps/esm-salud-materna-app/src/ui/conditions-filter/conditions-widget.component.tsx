import {
  FormGroup,
  FormLabel,
  InlineLoading,
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
import classNames from 'classnames';
import dayjs from 'dayjs';
import 'dayjs/plugin/utc';
import type { TFunction } from 'i18next';
import React, { type Dispatch, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../config-schema';
import { type DefaultPatientWorkspaceProps } from '../../types';
import {
  type CodedCondition,
  type Condition,
  createCondition,
  type FormFields,
  updateCondition,
  useConditions,
  useConditionsSearchFromConceptSet,
} from './conditions.resource';
import styles from './conditions-form.scss';
import { type ConditionsFormSchema } from './conditions-form.workspace';

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

const ConditionsWidget: React.FC<ConditionsWidgetProps> = ({
  closeWorkspace,
  conditionToEdit,
  isEditing,
  isSubmittingForm,
  patientUuid,
  setErrorCreating,
  setErrorUpdating,
  setIsSubmittingForm,
  workspaceProps,
}) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { conditions, mutate } = useConditions(patientUuid);
  const {
    control,
    formState: { errors },
    getValues,
    watch,
  } = useFormContext<ConditionsFormSchema>();
  const session = useSession();
  const searchInputRef = useRef(null);
  const clinicalStatus = watch('clinicalStatus');
  const matchingCondition = conditions?.find((condition) => condition?.id === conditionToEdit?.id);

  // El servidor es la fuente de verdad al editar; el prop (la fila
  // seleccionada) cubre el primer render mientras SWR resuelve.
  const displayName = matchingCondition?.display ?? conditionToEdit?.display;
  const editableClinicalStatus = matchingCondition?.clinicalStatus ?? conditionToEdit?.clinicalStatus;
  const editableAbatementDateTime = matchingCondition?.abatementDateTime ?? conditionToEdit?.abatementDateTime;
  const editableRecordedDate = matchingCondition?.recordedDate ?? conditionToEdit?.recordedDate;
  const [selectedCondition, setSelectedCondition] = useState<CodedCondition>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);

  // Get conceptSetUuid from workspace props or use default from config
  const conceptSetUuid = workspaceProps?.conceptSetUuid || config?.conditionConceptSets?.antecedentesPatologicos?.uuid;

  const { searchResults, isSearching } = useConditionsSearchFromConceptSet(debouncedSearchTerm, conceptSetUuid);

  const handleConditionChange = useCallback((selectedCondition: CodedCondition) => {
    setSelectedCondition(selectedCondition);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedCondition) {
      setIsSubmittingForm(false);
      setErrorCreating?.(new Error(t('conditionSelectionRequired', 'Select a condition from the search results.')));
      return;
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
      return;
    }

    const payload: FormFields = {
      clinicalStatus: getValues('clinicalStatus'),
      conceptId: selectedCondition?.uuid,
      display: selectedCondition?.display,
      abatementDateTime: getValues('abatementDateTime') ? dayjs(getValues('abatementDateTime')).format() : null,
      onsetDateTime: getValues('onsetDateTime') ? dayjs(getValues('onsetDateTime')).format() : null,
      patientId: patientUuid,
      providerUuid,
    };

    try {
      await createCondition(payload);
      await mutate();

      showSnackbar({
        kind: 'success',
        subtitle: t('conditionNowVisible', 'It is now visible on the Conditions page'),
        title: t('conditionSaved', 'Condition saved'),
      });

      closeWorkspace({ discardUnsavedChanges: true });
    } catch (error: unknown) {
      setIsSubmittingForm(false);
      setErrorCreating?.(
        new Error(
          getUserFacingErrorMessage(
            error,
            t('conditionSaveFailed', 'The condition could not be saved. Please try again.'),
            { logContext: 'Create maternal health condition' },
          ),
        ),
      );
    }
  }, [
    closeWorkspace,
    getValues,
    mutate,
    patientUuid,
    selectedCondition,
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
      return;
    }

    if (!conditionToEdit?.id || !matchingCondition?.conceptId || !displayName) {
      // Sin el antecedente resuelto el PUT saldría con conceptId/display
      // indefinidos y corrompería el registro clínico.
      setIsSubmittingForm(false);
      setErrorUpdating?.(
        new Error(
          t('conditionEditUnavailable', 'No se pudo cargar la condición a editar. Recargue e intente nuevamente.'),
        ),
      );
      return;
    }

    const payload: FormFields = {
      clinicalStatus: isEditing ? getValues('clinicalStatus') : editableClinicalStatus,
      conceptId: matchingCondition?.conceptId,
      display: displayName,
      abatementDateTime: isEditing
        ? getValues('abatementDateTime')
          ? dayjs(getValues('abatementDateTime')).format()
          : editableAbatementDateTime
        : null,
      onsetDateTime: getValues('onsetDateTime') ? dayjs(getValues('onsetDateTime')).format() : null,
      patientId: patientUuid,
      providerUuid,
      recordedDate: editableRecordedDate,
    };

    try {
      await updateCondition(conditionToEdit?.id, payload);
      await mutate();

      showSnackbar({
        kind: 'success',
        subtitle: t('conditionNowVisible', 'It is now visible on the Conditions page'),
        title: t('conditionUpdated', 'Condition updated'),
      });

      closeWorkspace({ discardUnsavedChanges: true });
    } catch (error: unknown) {
      setIsSubmittingForm(false);
      setErrorUpdating?.(
        new Error(
          getUserFacingErrorMessage(
            error,
            t('conditionUpdateFailed', 'The condition could not be updated. Please try again.'),
            { logContext: 'Update maternal health condition' },
          ),
        ),
      );
    }
  }, [
    closeWorkspace,
    conditionToEdit?.id,
    displayName,
    editableClinicalStatus,
    isEditing,
    getValues,
    matchingCondition?.conceptId,
    mutate,
    patientUuid,
    session?.currentProvider?.uuid,
    setErrorUpdating,
    setIsSubmittingForm,
    t,
    editableAbatementDateTime,
    editableRecordedDate,
  ]);

  const focusOnSearchInput = useCallback(() => {
    searchInputRef?.current?.focus();
  }, []);

  const handleSearchTermChange = (searchTerm: string) => {
    setSearchTerm(searchTerm);
  };

  useEffect(() => {
    if (errors?.conditionName) {
      focusOnSearchInput();
    }
    if (isSubmittingForm) {
      if (Object.keys(errors).length > 0) {
        setIsSubmittingForm(false);
        return;
      }
      isEditing ? handleUpdate() : handleCreate();
    }
  }, [handleUpdate, isEditing, handleCreate, isSubmittingForm, errors, setIsSubmittingForm, focusOnSearchInput]);

  return (
    <div className={styles.formContainer}>
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
                      id="conditionsSearch"
                      aria-labelledby={errors?.conditionName ? 'conditionsSearchError' : undefined}
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
                <p id="conditionsSearchError" className={styles.errorMessage}>
                  {errors.conditionName.message}
                </p>
              )}
              <SearchResults
                isSearching={isSearching}
                onConditionChange={handleConditionChange}
                searchResults={searchResults}
                selectedCondition={selectedCondition}
                t={t}
                value={searchTerm}
              />
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
                  id="onsetDate"
                  data-testid="onsetDate"
                  maxDate={new Date()}
                  labelText={t('onsetDate', 'Onset date')}
                  invalid={Boolean(fieldState?.error?.message)}
                  invalidText={fieldState?.error?.message}
                />
              </ResponsiveWrapper>
            )}
          />
        </FormGroup>
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
                aria-labelledby={errors?.clinicalStatus ? 'clinicalStatusError' : undefined}
              >
                <RadioButton id="active" labelText={t('active', 'Active')} value="active" />
                <RadioButton id="inactive" labelText={t('inactive', 'Inactive')} value="inactive" />
              </RadioButtonGroup>
            )}
          />
          {errors?.clinicalStatus && (
            <p id="clinicalStatusError" className={styles.errorMessage}>
              {errors.clinicalStatus.message}
            </p>
          )}
        </FormGroup>
        {(clinicalStatus.match(/inactive/i) || matchingCondition?.clinicalStatus?.match(/inactive/i)) && (
          <FormGroup legendText="">
            <Controller
              name="abatementDateTime"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <ResponsiveWrapper>
                    <OpenmrsDatePicker
                      {...field}
                      id="endDate"
                      data-testid="endDate"
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
    </div>
  );
};

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
