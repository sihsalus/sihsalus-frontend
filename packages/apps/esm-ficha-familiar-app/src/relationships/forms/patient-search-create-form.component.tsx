import {
  Button,
  Column,
  ContentSwitcher,
  DatePicker,
  DatePickerInput,
  Dropdown,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Switch,
  TextInput,
} from '@carbon/react';
import { Calculator } from '@carbon/react/icons';
import { showModal, useConfig } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { Autosuggest } from '../../autosuggest/autosuggest.component';
import PatientSearchInfo from '../../autosuggest/patient-search-info.component';
import SearchEmptyState from '../../autosuggest/search-empty-state.component';
import type { ConfigObject } from '../../config-schema';
import type { relationshipFormSchema } from '../relationship.resources';
import { fetchPerson, type PersonSearchResult } from '../relationship.resources';

import styles from './form.scss';

type PatientSearchCreateProps = {};

const PatientSearchCreate: React.FC<PatientSearchCreateProps> = () => {
  const form = useFormContext<z.infer<typeof relationshipFormSchema>>();
  const { t } = useTranslation(); // Usar el hook t para las traducciones
  const config = useConfig<ConfigObject>();

  const searchPerson = async (query: string) => {
    const abortController = new AbortController();
    return await fetchPerson(query, abortController);
  };

  const handleAdd = () => {
    form.setValue('personB', undefined);
    form.setValue('mode', 'create');
  };
  const maritalStatus = useMemo(
    () =>
      Object.entries(config.contactListConceptMap[config.concepts.maritalStatusConceptUuid]?.answers ?? {}).map(
        ([uuid, display]) => ({
          label: display,
          value: uuid,
        }),
      ),
    [config.concepts.maritalStatusConceptUuid, config.contactListConceptMap],
  );

  const handleCalculateBirthDate = () => {
    const dispose = showModal('birth-date-calculator', {
      onClose: () => dispose(),
      props: {
        date: new Date(),
        onBirthDateChange: (date) => {
          form.setValue('personBInfo.birthdate', date, { shouldDirty: true, shouldValidate: true });
          form.setValue('personBInfo.birthdateEstimated', true, { shouldDirty: true });
        },
      },
    });
  };

  const mode = form.watch('mode');
  const isRelationshipRetry = mode === 'create' && Boolean(form.watch('personB'));

  return (
    <>
      <Column>
        <Controller
          control={form.control}
          name="mode"
          render={({ field }) => (
            <ContentSwitcher
              selectedIndex={field.value === 'search' ? 0 : 1}
              onChange={(value) => {
                const { name } = value;
                if (name !== field.value) {
                  form.setValue('personB', undefined);
                }
                field.onChange(name);
              }}
            >
              <Switch name="search" text={t('searchPerson', 'Search person')} />
              <Switch name="create" text={t('createRelative', 'Create relative')} />
            </ContentSwitcher>
          )}
        />
      </Column>
      {mode === 'search' && (
        <Column>
          <Controller
            control={form.control}
            name="personB"
            render={({ field, fieldState: { error } }) => (
              <Autosuggest
                className={styles.input}
                labelText={t('person', 'Person')}
                placeholder={t('personPlaceHolder', 'Search person')}
                invalid={Boolean(error?.message)}
                invalidText={error?.message}
                getDisplayValue={(item) => (item as PersonSearchResult).display}
                renderSuggestionItem={(item) => <PatientSearchInfo person={item as PersonSearchResult} />}
                getFieldValue={(item) => (item as PersonSearchResult).uuid}
                getSearchResults={searchPerson}
                renderEmptyState={(value) => (
                  <SearchEmptyState
                    searchValue={value}
                    message={t('personNotFound', 'Person not found')}
                    onAdd={handleAdd}
                  />
                )}
                onClear={() => field.onChange('')}
                onSuggestionSelected={(_field_, value) => {
                  if (value) {
                    field.onChange(value);
                  }
                }}
              />
            )}
          />
        </Column>
      )}
      {isRelationshipRetry && (
        <Column>
          <InlineNotification
            kind="warning"
            lowContrast
            hideCloseButton
            title={t('personAlreadyCreated', 'Person already created')}
            subtitle={t(
              'personAlreadyCreatedRetry',
              'Only the relationship is pending. Save again to reuse this person without creating a duplicate.',
            )}
          />
        </Column>
      )}
      {mode === 'create' && !isRelationshipRetry && (
        <>
          <span className={styles.sectionHeader}>{t('demographics', 'Demographics')}</span>
          <Column>
            <Controller
              control={form.control}
              name="personBInfo.givenName"
              render={({ field, fieldState: { error } }) => (
                <TextInput
                  id={field.name}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  {...field}
                  placeholder={t('firstNamePlaceholder', 'First name')}
                  labelText={t('firstName', 'First name')}
                />
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="personBInfo.middleName"
              render={({ field, fieldState: { error } }) => (
                <TextInput
                  id={field.name}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  {...field}
                  placeholder={t('middleNamePlaceholder', 'Middle name')}
                  labelText={t('middleName', 'Middle name')}
                />
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="personBInfo.familyName"
              render={({ field, fieldState: { error } }) => (
                <TextInput
                  id={field.name}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  {...field}
                  placeholder={t('lastNamePlaceholder', 'Last name')}
                  labelText={t('lastName', 'Last name')}
                />
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="personBInfo.familyName2"
              render={({ field, fieldState: { error } }) => (
                <TextInput
                  id={field.name}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  {...field}
                  placeholder={t('lastNamePlaceholder2', 'Segundo Apellido')}
                  labelText={t('lastName2', 'Segundo Apellido')}
                />
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="personBInfo.gender"
              render={({ field, fieldState: { error } }) => (
                <>
                  <RadioButtonGroup
                    name="personBInfo.gender"
                    legendText={t('sex', 'Sex')}
                    {...field}
                    invalid={!!error?.message}
                    invalidText={error?.message}
                  >
                    <RadioButton labelText={t('male', 'Male')} value="M" id="M" />
                    <RadioButton labelText={t('female', 'Female')} value="F" id="F" />
                  </RadioButtonGroup>
                </>
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="personBInfo.birthdate"
              render={({ field, fieldState: { error } }) => (
                <DatePicker
                  datePickerType="single"
                  {...field}
                  onChange={([date]) => {
                    field.onChange(date);
                    form.setValue('personBInfo.birthdateEstimated', false, { shouldDirty: true });
                  }}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  className={styles.datePickerInput}
                >
                  <DatePickerInput
                    id={field.name}
                    invalid={!!error?.message}
                    invalidText={error?.message}
                    placeholder={t('dateOfBirthPlaceholder', 'mm/dd/yyyy')}
                    labelText={t('dateOfBirth', 'Date of birth')}
                    size="lg"
                  />
                </DatePicker>
              )}
            />
            <Button kind="ghost" renderIcon={Calculator} onClick={handleCalculateBirthDate}>
              {t('fromAge', 'From Age')}
            </Button>
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="personBInfo.maritalStatus"
              render={({ field, fieldState: { error } }) => (
                <Dropdown
                  ref={field.ref}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  id="maritalStatus"
                  titleText={t('maritalStatus', 'Marital status')}
                  onChange={(e) => {
                    field.onChange(e.selectedItem);
                  }}
                  initialSelectedItem={field.value}
                  label={t('chooseOption', 'Choose option')}
                  items={maritalStatus.map((r) => r.value)}
                  itemToString={(item) => maritalStatus.find((r) => r.value === item)?.label ?? ''}
                />
              )}
            />
          </Column>
          <span className={styles.sectionHeader}>{t('contact', 'Contact')}</span>
          <Column>
            <Controller
              control={form.control}
              name="personBInfo.address"
              render={({ field, fieldState: { error } }) => (
                <TextInput
                  id={field.name}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  {...field}
                  placeholder={t('addressPlaceholder', 'Physical Address/Landmark')}
                  labelText={t('address', 'Address')}
                />
              )}
            />
          </Column>
          <Column>
            <Controller
              control={form.control}
              name="personBInfo.phoneNumber"
              render={({ field, fieldState: { error } }) => (
                <TextInput
                  id={field.name}
                  {...field}
                  invalid={!!error?.message}
                  invalidText={error?.message}
                  placeholder={t('phoneNumberPlaceholder', 'Phone number')}
                  labelText={t('phoneNumber', 'Phone number')}
                />
              )}
            />
          </Column>
        </>
      )}
    </>
  );
};

export default PatientSearchCreate;
