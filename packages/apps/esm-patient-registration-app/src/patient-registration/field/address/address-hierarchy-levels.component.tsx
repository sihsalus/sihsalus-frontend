import { useField } from 'formik';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import ComboInput from '../../input/combo-input/combo-input.component';
import { useAddressEntries, useAddressEntryFetchConfig } from './address-hierarchy.resource';
import { type AddressFieldDefinition } from './address-types';

interface AddressComboBoxProps {
  attribute: AddressFieldDefinition;
}

interface AddressHierarchyLevelsProps {
  orderedAddressFields: Array<AddressFieldDefinition>;
}

const AddressComboBox: React.FC<AddressComboBoxProps> = ({ attribute }) => {
  const { t } = useTranslation(moduleName);
  const [field, meta, { setValue }] = useField(`address.${attribute.name}`);
  const { fetchEntriesForField, searchString, updateChildElements } = useAddressEntryFetchConfig(attribute.name);
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
      name={`address.${attribute.name}`}
      fieldProps={{
        ...field,
        id: attribute.name,
        labelText: label,
        required: attribute?.required,
      }}
      handleInputChange={handleInputChange}
    />
  );
};

const AddressHierarchyLevels: React.FC<AddressHierarchyLevelsProps> = ({ orderedAddressFields }) => {
  return (
    <>
      {orderedAddressFields.map((attribute) => (
        <AddressComboBox key={attribute.id} attribute={attribute} />
      ))}
    </>
  );
};

export default AddressHierarchyLevels;
