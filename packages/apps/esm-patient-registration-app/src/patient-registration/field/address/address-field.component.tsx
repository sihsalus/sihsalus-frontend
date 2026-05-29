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

const peruAddressDefaults = {
  country: 'Perú',
};

export const AddressComponent: React.FC = () => {
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
  const { orderedFields, isLoadingFieldOrder, errorFetchingFieldOrder } = useOrderedAddressHierarchyLevels();
  const hasAddressTemplate = !!addressTemplate?.lines?.length;
  const isAddressTemplateLoading =
    isLoadingAddressTemplate ||
    (isLoadingAddressTemplate === undefined && !addressTemplateError && !hasAddressTemplate);

  useEffect(() => {
    if (!addressLayout.length) {
      return;
    }

    const availableAddressFields = new Set<string>(addressLayout.map((field) => field.name));
    const defaults = {
      ...(inEditMode ? {} : peruAddressDefaults),
      ...(addressTemplate?.elementDefaults ?? {}),
    };

    Object.entries(defaults).forEach(([name, defaultValue]) => {
      if (availableAddressFields.has(name) && defaultValue && !Object.hasOwn(values.address ?? {}, name)) {
        setFieldValue(`address.${name}`, defaultValue);
      }
    });
  }, [addressLayout, addressTemplate?.elementDefaults, inEditMode, setFieldValue, values.address]);

  const orderedAddressFields = useMemo(() => {
    if (isLoadingFieldOrder || errorFetchingFieldOrder) {
      return [];
    }

    if (!orderedFields?.length) {
      return addressLayout;
    }

    const orderMap = Object.fromEntries(orderedFields.map((field, indx) => [field, indx]));

    return [...addressLayout].sort(
      (existingField1, existingField2) =>
        (orderMap[existingField1.name] ?? Number.MAX_SAFE_INTEGER) -
        (orderMap[existingField2.name] ?? Number.MAX_SAFE_INTEGER),
    );
  }, [isLoadingFieldOrder, errorFetchingFieldOrder, orderedFields, addressLayout]);

  if (isAddressTemplateLoading) {
    return (
      <AddressComponentContainer>
        <div role="progressbar">
          <SkeletonText />
        </div>
      </AddressComponentContainer>
    );
  }

  if (!hasAddressTemplate) {
    return (
      <AddressComponentContainer>
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
      <AddressComponentContainer>
        {addressLayout.map((attributes, index) => (
          <Input
            key={`combo_input_${index}`}
            name={`address.${attributes.name}`}
            labelText={t(attributes.label)}
            id={attributes.name}
            value={selected}
            required={attributes.required}
          />
        ))}
      </AddressComponentContainer>
    );
  }

  if (isLoadingFieldOrder) {
    return (
      <AddressComponentContainer>
        <SkeletonText />
      </AddressComponentContainer>
    );
  }

  if (errorFetchingFieldOrder) {
    return (
      <AddressComponentContainer>
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
    <AddressComponentContainer>
      {useQuickSearch && <AddressSearchComponent addressLayout={orderedAddressFields} />}
      {searchAddressByLevel ? (
        <AddressHierarchyLevels orderedAddressFields={orderedAddressFields} />
      ) : (
        orderedAddressFields.map((attributes, index) => (
          <Input
            key={`combo_input_${index}`}
            name={`address.${attributes.name}`}
            labelText={t(attributes.label)}
            id={attributes.name}
            value={selected}
            required={attributes.required}
          />
        ))
      )}
    </AddressComponentContainer>
  );
};

const AddressComponentContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation(moduleName);
  return (
    <div className={styles.fullWidthInDesktopView}>
      <h4 className={styles.productiveHeading02Light}>{t('addressHeader', 'Address')}</h4>
      <div className={styles.addressFieldGrid}>{children}</div>
    </div>
  );
};
