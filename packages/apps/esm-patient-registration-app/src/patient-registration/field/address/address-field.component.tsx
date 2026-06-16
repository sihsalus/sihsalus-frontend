import { InlineNotification, SkeletonText } from '@carbon/react';
import { useConfig, useConnectivity } from '@openmrs/esm-framework';
import React, { useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import { ResourcesContext } from '../../../offline.resources';
import { Input } from '../../input/basic-input/input/input.component';
import { PatientRegistrationContext } from '../../patient-registration-context';
import styles from '../field.scss';
import { useOrderedAddressHierarchyLevels } from './address-hierarchy.resource';
import AddressHierarchyLevels from './address-hierarchy-levels.component';
import AddressSearchComponent from './address-search.component';
import { type AddressFieldDefinition } from './address-types';

const peruAddressDefaults = {
  country: 'Perú',
};

interface AddressComponentProps {
  applyDefaults?: boolean;
  fieldPrefix?: 'address' | 'birthAddress';
  forceOptionalFields?: boolean;
  headingDefault?: string;
  headingKey?: string;
  searchLabelDefault?: string;
  searchLabelKey?: string;
}

export const AddressComponent: React.FC<AddressComponentProps> = ({
  applyDefaults = true,
  fieldPrefix = 'address',
  forceOptionalFields = false,
  headingDefault = 'Address',
  headingKey = 'addressHeader',
  searchLabelDefault = 'Address',
  searchLabelKey = 'addressHeader',
}) => {
  const selected = '';
  const { addressTemplate, addressTemplateError, isLoadingAddressTemplate } = useContext(ResourcesContext);
  const addressLayout = useMemo(() => {
    if (!addressTemplate?.lines) {
      return [];
    }

    const allFields = addressTemplate?.lines?.flat();
    const fields = allFields?.filter(({ isToken }) => isToken === 'IS_ADDR_TOKEN');
    const allRequiredFields = Object.fromEntries(addressTemplate?.requiredElements?.map((curr) => [curr, curr]) || []);
    return fields.map(({ displayText, codeName }) => {
      return {
        id: codeName,
        name: codeName,
        label: displayText,
        required: Boolean(allRequiredFields[codeName]),
      };
    });
  }, [addressTemplate]);

  const { t } = useTranslation(moduleName);
  const config = useConfig();
  const isOnline = useConnectivity();
  const {
    fieldConfigurations: {
      address: {
        useAddressHierarchy: { enabled: addressHierarchyEnabled, useQuickSearch, searchAddressByLevel },
      },
    },
  } = config;

  const { inEditMode, setFieldValue, values } = useContext(PatientRegistrationContext);
  const addressValues = values[fieldPrefix] ?? {};
  const { orderedFields, requiredFields, isLoadingFieldOrder, errorFetchingFieldOrder } =
    useOrderedAddressHierarchyLevels();
  const hasAddressTemplate = !!addressTemplate?.lines?.length;
  const isAddressTemplateLoading =
    isLoadingAddressTemplate ||
    (isLoadingAddressTemplate === undefined && !addressTemplateError && !hasAddressTemplate);
  const addressFields = useMemo<Array<AddressFieldDefinition>>(
    () =>
      addressLayout.map((field) => ({
        ...field,
        required:
          !forceOptionalFields &&
          (field.required || (addressHierarchyEnabled && (requiredFields?.has(field.name) ?? false))),
      })),
    [addressHierarchyEnabled, addressLayout, forceOptionalFields, requiredFields],
  );

  useEffect(() => {
    if (!applyDefaults || !addressFields.length) {
      return;
    }

    const availableAddressFields = new Set<string>(addressFields.map((field) => field.name));
    const defaults = {
      ...(inEditMode ? {} : peruAddressDefaults),
      ...(addressTemplate?.elementDefaults ?? {}),
    };

    Object.entries(defaults).forEach(([name, defaultValue]) => {
      if (availableAddressFields.has(name) && defaultValue && !Object.hasOwn(addressValues, name)) {
        setFieldValue(`${fieldPrefix}.${name}`, defaultValue);
      }
    });
  }, [
    addressFields,
    addressTemplate?.elementDefaults,
    addressValues,
    applyDefaults,
    fieldPrefix,
    inEditMode,
    setFieldValue,
  ]);

  const orderedAddressFields = useMemo(() => {
    if (isLoadingFieldOrder || errorFetchingFieldOrder) {
      return [];
    }

    if (!orderedFields?.length) {
      return addressFields;
    }

    const orderMap = Object.fromEntries(orderedFields.map((field, indx) => [field, indx]));

    return [...addressFields].sort(
      (existingField1, existingField2) =>
        (orderMap[existingField1.name] ?? Number.MAX_SAFE_INTEGER) -
        (orderMap[existingField2.name] ?? Number.MAX_SAFE_INTEGER),
    );
  }, [isLoadingFieldOrder, errorFetchingFieldOrder, orderedFields, addressFields]);

  if (isAddressTemplateLoading) {
    return (
      <AddressComponentContainer headingDefault={headingDefault} headingKey={headingKey}>
        <div role="progressbar">
          <SkeletonText />
        </div>
      </AddressComponentContainer>
    );
  }

  if (!hasAddressTemplate) {
    return (
      <AddressComponentContainer headingDefault={headingDefault} headingKey={headingKey}>
        <InlineNotification
          style={{ margin: '0', minWidth: '100%' }}
          kind={addressTemplateError ? 'error' : 'warning'}
          lowContrast={true}
          title={t('addressFieldsUnavailableTitle', 'Address fields unavailable')}
          subtitle={t(
            'addressFieldsUnavailableSubtitle',
            'Refresh the page. If the problem continues, check that the address template is configured and that your session is active.',
          )}
        />
      </AddressComponentContainer>
    );
  }

  if (!addressHierarchyEnabled || !isOnline) {
    return (
      <AddressComponentContainer headingDefault={headingDefault} headingKey={headingKey}>
        {addressFields.map((attributes) => (
          <Input
            key={`${fieldPrefix}_input_${attributes.name}`}
            name={`${fieldPrefix}.${attributes.name}`}
            labelText={t(attributes.label)}
            id={`${fieldPrefix}.${attributes.name}`}
            value={selected}
            required={attributes.required}
          />
        ))}
      </AddressComponentContainer>
    );
  }

  if (isLoadingFieldOrder) {
    return (
      <AddressComponentContainer headingDefault={headingDefault} headingKey={headingKey}>
        <SkeletonText />
      </AddressComponentContainer>
    );
  }

  if (errorFetchingFieldOrder) {
    return (
      <AddressComponentContainer headingDefault={headingDefault} headingKey={headingKey}>
        <InlineNotification
          style={{ margin: '0', minWidth: '100%' }}
          kind="error"
          lowContrast={true}
          title={t('errorFetchingOrderedFields', 'Error occurred fetching ordered fields for address hierarchy')}
        />
      </AddressComponentContainer>
    );
  }

  return (
    <AddressComponentContainer headingDefault={headingDefault} headingKey={headingKey}>
      {useQuickSearch && (
        <AddressSearchComponent
          addressLayout={orderedAddressFields}
          fieldPrefix={fieldPrefix}
          labelDefault={searchLabelDefault}
          labelKey={searchLabelKey}
        />
      )}
      {searchAddressByLevel ? (
        <AddressHierarchyLevels orderedAddressFields={orderedAddressFields} fieldPrefix={fieldPrefix} />
      ) : (
        orderedAddressFields.map((attributes) => (
          <Input
            key={`${fieldPrefix}_input_${attributes.name}`}
            name={`${fieldPrefix}.${attributes.name}`}
            labelText={t(attributes.label)}
            id={`${fieldPrefix}.${attributes.name}`}
            value={selected}
            required={attributes.required}
          />
        ))
      )}
    </AddressComponentContainer>
  );
};

const AddressComponentContainer: React.FC<{
  children: React.ReactNode;
  headingDefault: string;
  headingKey: string;
}> = ({ children, headingDefault, headingKey }) => {
  const { t } = useTranslation(moduleName);
  return (
    <div className={styles.fullWidthInDesktopView}>
      <h4 className={styles.productiveHeading02Light}>{t(headingKey, headingDefault)}</h4>
      <div className={styles.addressFieldGrid}>{children}</div>
    </div>
  );
};
