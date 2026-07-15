import classNames from 'classnames';
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import React, { type Dispatch, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'dayjs/plugin/utc';
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
import { OpenmrsDatePicker, ResponsiveWrapper, showSnackbar, useDebounce, useSession } from '@openmrs/esm-framework';
import {
  type AntecedentTypeCode,
  antecedentTypeOptions,
  getAntecedentTypeLabel,
} from '@openmrs/esm-patient-common-lib';
import { Controller, useFormContext } from 'react-hook-form';
import {
  type CodedCondition,
  type Condition,
  createCondition,
  type FormFields,
  updateCondition,
  useConditions,
  useConditionsSearch,
} from './conditions.resource';
import styles from './conditions-form.scss';
import { type ConditionsFormSchema } from './conditions-form.workspace';

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
  closeWorkspaceWithSavedChanges,
  conditionToEdit,
  isEditing,
  isSubmittingForm,
  patientUuid,
  setErrorCreating,
  setErrorUpdating,
  setIsSubmittingForm,
  lockedAntecedentType,
}) => {
  const { t } = useTranslation();
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
  const editableCondition = matchingCondition ?? conditionToEdit;

  const editableConditionId = editableCondition?.id;
  const editableConceptId = editableCondition?.conceptId;
  const displayName = editableCondition?.display;
  const editableClinicalStatus = editableCondition?.clinicalStatus;
  const editableAntecedentType = editableCondition?.antecedentType;
  const [selectedCondition, setSelectedCondition] = useState<CodedCondition>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);
  const { searchResults, isSearching } = useConditionsSearch(debouncedSearchTerm);
  const availableAntecedentTypeOptions = useMemo(
    () =>
      antecedentTypeOptions.filter(
        (option) => option.code !== 'surgical' || lockedAntecedentType || editableAntecedentType === 'surgical',
      ),
    [editableAntecedentType, lockedAntecedentType],
  );

  const handleConditionChange = useCallback((selectedCondition: CodedCondition) => {
    setSelectedCondition(selectedCondition);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedCondition) {
      setIsSubmittingForm(false);
      return;
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
      return;
    }

    const selectedClinicalStatus = getValues('clinicalStatus');

    const payload: FormFields = {
      clinicalStatus: selectedClinicalStatus,
      conceptId: selectedCondition?.uuid,
      display: selectedCondition?.display,
      abatementDateTime:
        selectedClinicalStatus === 'inactive' && getValues('abatementDateTime')
          ? dayjs(getValues('abatementDateTime')).format()
          : undefined,
      onsetDateTime: getValues('onsetDateTime') ? dayjs(getValues('onsetDateTime')).format() : undefined,
      patientId: patientUuid,
      providerUuid,
      antecedentType: getValues('antecedentType') as AntecedentTypeCode,
    };

    try {
      await createCondition(payload);
      await mutate();

      showSnackbar({
        kind: 'success',
        subtitle: t('antecedentNowVisible', 'It is now visible on the Antecedents page'),
        title: t('antecedentSaved', 'Antecedent saved'),
      });

      closeWorkspaceWithSavedChanges();
    } catch (error) {
      setIsSubmittingForm(false);
      setErrorCreating(error);
    }
  }, [
    closeWorkspaceWithSavedChanges,
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
            'clinicalProviderRequiredForAntecedent',
            'Your session is not linked to a clinical provider. Sign in with a clinical account and try again.',
          ),
        ),
      );
      return;
    }

    if (!editableConditionId || !editableConceptId || !displayName) {
      setIsSubmittingForm(false);
      setErrorUpdating?.(
        new Error(t('antecedentDataUnavailable', 'The antecedent data could not be loaded. Reopen it and try again.')),
      );
      return;
    }

    const selectedClinicalStatus = isEditing ? getValues('clinicalStatus') : editableClinicalStatus;
    const payload: FormFields = {
      clinicalStatus: selectedClinicalStatus,
      conceptId: editableConceptId,
      display: displayName,
      abatementDateTime:
        selectedClinicalStatus === 'inactive' && getValues('abatementDateTime')
          ? dayjs(getValues('abatementDateTime')).format()
          : undefined,
      onsetDateTime: getValues('onsetDateTime') ? dayjs(getValues('onsetDateTime')).format() : undefined,
      patientId: patientUuid,
      providerUuid,
      antecedentType: getValues('antecedentType') as AntecedentTypeCode,
    };

    try {
      await updateCondition(editableConditionId, payload);
      await mutate();

      showSnackbar({
        kind: 'success',
        subtitle: t('antecedentNowVisible', 'It is now visible on the Antecedents page'),
        title: t('antecedentUpdated', 'Antecedent updated'),
      });

      closeWorkspaceWithSavedChanges();
    } catch (error) {
      setIsSubmittingForm(false);
      setErrorUpdating(error);
    }
  }, [
    closeWorkspaceWithSavedChanges,
    displayName,
    editableClinicalStatus,
    editableConceptId,
    editableConditionId,
    isEditing,
    getValues,
    mutate,
    patientUuid,
    session?.currentProvider?.uuid,
    setErrorUpdating,
    setIsSubmittingForm,
    t,
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
        Object.entries(errors).map((key, err) => console.error(`${key}: ${err} `));
        return;
      }
      if (isEditing) {
        handleUpdate();
      } else {
        handleCreate();
      }
    }
  }, [handleUpdate, isEditing, handleCreate, isSubmittingForm, errors, setIsSubmittingForm, focusOnSearchInput]);

  return (
    <div className={styles.formContainer}>
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
                aria-labelledby={errors?.antecedentType ? 'antecedentTypeError' : undefined}
              >
                {availableAntecedentTypeOptions.map((option) => (
                  <RadioButton
                    key={option.code}
                    id={`antecedent-type-${option.code}`}
                    labelText={getAntecedentTypeLabel(option.code, t)}
                    value={option.code}
                    disabled={lockedAntecedentType}
                  />
                ))}
              </RadioButtonGroup>
            )}
          />
          {errors?.antecedentType && (
            <p id="antecedentTypeError" className={styles.errorMessage}>
              {errors.antecedentType.message}
            </p>
          )}
        </FormGroup>
        <FormGroup legendText={<RequiredFieldLabel label={t('antecedent', 'Antecedent')} t={t} />}>
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
                      labelText={t('enterAntecedent', 'Enter antecedent')}
                      onChange={(event) => {
                        const val = event.target.value;
                        onChange(val);
                        handleSearchTermChange(val);
                      }}
                      onClear={() => {
                        setSearchTerm('');
                        setSelectedCondition(null);
                      }}
                      placeholder={t('searchAntecedents', 'Search antecedents')}
                      ref={searchInputRef}
                      renderIcon={errors?.conditionName && ((props) => <WarningFilled fill="red" {...props} />)}
                      value={(() => {
                        if (selectedCondition) {
                          return selectedCondition.display;
                        }
                        if (debouncedSearchTerm) {
                          return value;
                        }
                      })()}
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
          {t('noResultsFor', 'No results for')} <strong>"{value}"</strong>
        </span>
      </Tile>
    </Layer>
  );
}

export default ConditionsWidget;
