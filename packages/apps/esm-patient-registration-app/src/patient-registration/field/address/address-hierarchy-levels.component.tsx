import { useField } from 'formik';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import ComboInput from '../../input/combo-input/combo-input.component';
import { validateRequiredField } from '../../validation/required-field-validation';
import { useAddressEntries, useAddressEntryFetchConfig } from './address-hierarchy.resource';
import { type AddressFieldDefinition } from './address-types';

interface AddressComboBoxProps {
  attribute: AddressFieldDefinition;
  fieldPrefix?: string;
}

interface AddressHierarchyLevelsProps {
  orderedAddressFields: Array<AddressFieldDefinition>;
  fieldPrefix?: string;
}

const AddressComboBox: React.FC<AddressComboBoxProps> = ({ attribute, fieldPrefix = 'address' }) => {
  const { t } = useTranslation(moduleName);
  const fieldName = `${fieldPrefix}.${attribute.name}`;
  const [field, meta, { setValue }] = useField({
    name: fieldName,
    validate: attribute.required ? validateRequiredField : undefined,
  });
  const { fetchEntriesForField, searchString, updateChildElements } = useAddressEntryFetchConfig(
    attribute.name,
    fieldPrefix,
  );
  const { entries, isLoadingAddressEntries, errorFetchingAddressEntries } = useAddressEntries(
    fetchEntriesForField,
    searchString,
  );
  const label = attribute?.required ? t(attribute.label) : t(attribute.label) + ` (${t('optional', 'optional')})`;

  const handleInputChange = useCallback(
    (newValue) => {
      setValue(newValue);
    },
    [setValue],
  );

  const handleSelection = useCallback(
    (selectedItem) => {
      if (meta.value !== selectedItem) {
        setValue(selectedItem);
        updateChildElements();
      }
    },
    [updateChildElements, meta.value, setValue],
  );

  return (
    <ComboInput
      entries={entries}
      error={errorFetchingAddressEntries}
      isLoading={isLoadingAddressEntries}
      handleSelection={handleSelection}
      name={fieldName}
      fieldProps={{
        ...field,
        id: fieldName,
        labelText: label,
        required: attribute?.required,
        invalid: !!(meta.touched && meta.error),
        invalidText: meta.error ? t(meta.error) : undefined,
      }}
      handleInputChange={handleInputChange}
    />
  );
};

const AddressHierarchyLevels: React.FC<AddressHierarchyLevelsProps> = ({ orderedAddressFields, fieldPrefix }) => {
  return (
    <>
      {orderedAddressFields.map((attribute) => (
        <AddressComboBox
          key={`${fieldPrefix ?? 'address'}-${attribute.id}`}
          attribute={attribute}
          fieldPrefix={fieldPrefix}
        />
      ))}
    </>
  );
};

export default AddressHierarchyLevels;
