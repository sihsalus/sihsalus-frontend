import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form, Formik } from 'formik';
import { mockedAddressTemplate, mockedOrderedFields, mockOpenmrsId, mockPatient, mockSession } from 'test-utils';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../../../../config-schema';
import { type Resources, ResourcesContext } from '../../../../offline.resources';
import { type AddressTemplate } from '../../../patient-registration.types';
import {
  PatientRegistrationContext,
  type PatientRegistrationContextProps,
} from '../../../patient-registration-context';
import {
  addressUbigeoField,
  addressUbigeoPathField,
  addressUbigeoPathSeparator,
} from '../../../patient-registration-utils';
import { AddressComponent } from '../address-field.component';
import { useOrderedAddressHierarchyLevels } from '../address-hierarchy.resource';

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);
const mockUseOrderedAddressHierarchyLevels = vi.mocked(useOrderedAddressHierarchyLevels);

const peruAddressLabels: Record<string, string> = {
  address1: 'Department',
  address3: 'Neighborhood',
  address4: 'Address',
  cityVillage: 'Population center',
  country: 'Country',
  countyDistrict: 'District',
  stateProvince: 'Province',
};

function getExpectedAddressLabel(field: { codeName?: string; displayText: string }) {
  return (field.codeName && peruAddressLabels[field.codeName]) || field.displayText;
}

const mockResourcesContextValue = {
  addressTemplate: {} as AddressTemplate,
  currentSession: mockSession.data,
  identifierTypes: [],
  relationshipTypes: [],
} as Resources;

const mockInitialFormValues = {
  additionalFamilyName: '',
  additionalFamilyName2: '',
  additionalGivenName: '',
  additionalMiddleName: '',
  addNameInLocalLanguage: false,
  address: {},
  birthAddress: {},
  birthdate: '',
  birthdateEstimated: false,
  deathCause: '',
  deathDate: '',
  deathTime: '',
  deathTimeFormat: 'AM' as const,
  familyName: 'Doe',
  familyName2: '',
  gender: 'male',
  givenName: 'John',
  identifiers: mockOpenmrsId,
  isDead: false,
  middleName: 'Test',
  monthsEstimated: 0,
  nonCodedCauseOfDeath: '',
  patientUuid: mockPatient.uuid,
  relationships: [],
  telephoneNumber: '',
  yearsEstimated: 0,
};

const initialContextValues: PatientRegistrationContextProps = {
  currentPhoto: '',
  inEditMode: false,
  identifierTypes: [],
  initialFormValues: mockInitialFormValues,
  isOffline: false,
  setCapturePhotoProps: vi.fn(),
  setFieldValue: vi.fn(),
  setFieldTouched: vi.fn(),
  setInitialFormValues: vi.fn(),
  validationSchema: null,
  values: mockInitialFormValues,
};

vi.mock('../address-hierarchy.resource', async () => ({
  ...(await vi.importActual('../address-hierarchy.resource')),
  useOrderedAddressHierarchyLevels: vi.fn(),
}));

async function renderAddressHierarchy(contextValues: PatientRegistrationContextProps) {
  await render(
    <ResourcesContext.Provider value={mockResourcesContextValue}>
      <Formik initialValues={mockInitialFormValues} onSubmit={null}>
        <Form>
          <PatientRegistrationContext.Provider value={contextValues}>
            <AddressComponent />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>
    </ResourcesContext.Provider>,
  );
}

async function renderBirthAddressHierarchy(contextValues: PatientRegistrationContextProps) {
  await render(
    <ResourcesContext.Provider value={mockResourcesContextValue}>
      <Formik initialValues={mockInitialFormValues} onSubmit={null}>
        <Form>
          <PatientRegistrationContext.Provider value={contextValues}>
            <AddressComponent
              fieldPrefix="birthAddress"
              headingKey="birthplaceSubsectionHeading"
              headingDefault="Lugar de nacimiento"
              applyDefaults={false}
              forceOptionalFields={true}
            />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>
    </ResourcesContext.Provider>,
  );
}

describe('Address hierarchy', () => {
  beforeEach(() => {
    mockResourcesContextValue.addressTemplate = {} as AddressTemplate;
    mockResourcesContextValue.addressTemplateError = undefined;
    mockResourcesContextValue.isLoadingAddressTemplate = undefined;
  });

  it('renders a loading skeleton when the address template is loading', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: false,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    renderAddressHierarchy(initialContextValues);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders a loading skeleton when the address hierarchy feature is enabled and address hierarchy order levels are loading', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: true,
      errorFetchingFieldOrder: undefined,
    });

    renderAddressHierarchy(initialContextValues);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders a loading skeleton when the address hierarchy feature is enabled and address hierarchy order levels are loading', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    renderAddressHierarchy(initialContextValues);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the address component with address hierarchy disabled', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: false,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = mockedAddressTemplate;

    renderAddressHierarchy(initialContextValues);

    const allFields = mockedAddressTemplate.lines.flat().filter(({ isToken }) => isToken === 'IS_ADDR_TOKEN');
    allFields.forEach((field) => {
      const textFieldInput = screen.getByLabelText(`${getExpectedAddressLabel(field)} (optional)`);
      expect(textFieldInput).toBeInTheDocument();
    });
  });

  it('uses the Peruvian administrative labels instead of the backend template labels', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: false,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });
    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });
    mockResourcesContextValue.addressTemplate = {
      ...mockedAddressTemplate,
      lines: [
        [
          { codeName: 'address4', displayText: 'Address line 4', isToken: 'IS_ADDR_TOKEN' },
          { codeName: 'address3', displayText: 'Address line 3', isToken: 'IS_ADDR_TOKEN' },
          { codeName: 'cityVillage', displayText: 'City', isToken: 'IS_ADDR_TOKEN' },
          { codeName: 'countyDistrict', displayText: 'County', isToken: 'IS_ADDR_TOKEN' },
          { codeName: 'stateProvince', displayText: 'State', isToken: 'IS_ADDR_TOKEN' },
          { codeName: 'address1', displayText: 'Address line 1', isToken: 'IS_ADDR_TOKEN' },
          { codeName: 'country', displayText: 'Country', isToken: 'IS_ADDR_TOKEN' },
        ],
      ],
    } as AddressTemplate;

    renderAddressHierarchy(initialContextValues);

    expect(screen.getByLabelText('Address (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Neighborhood (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Population center (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('District (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Province (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Department (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Country (optional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Address line 1 (optional)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('State (optional)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('City (optional)')).not.toBeInTheDocument();
  });

  it('defaults country to Peru when the address template has no country default', async () => {
    const setFieldValue = vi.fn();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: false,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = {
      ...mockedAddressTemplate,
      elementDefaults: {},
    };

    renderAddressHierarchy({
      ...initialContextValues,
      setFieldValue,
      values: {
        ...mockInitialFormValues,
        address: {},
      },
    });

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('address.country', 'Perú'));
  });

  it('does not apply the Peru country fallback while editing an existing patient', async () => {
    const setFieldValue = vi.fn();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: false,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = {
      ...mockedAddressTemplate,
      elementDefaults: {},
    };

    renderAddressHierarchy({
      ...initialContextValues,
      inEditMode: true,
      setFieldValue,
      values: {
        ...mockInitialFormValues,
        address: {},
      },
    });

    expect(setFieldValue).not.toHaveBeenCalledWith('address.country', 'Perú');
  });

  it('does not apply residence defaults to the birthplace address', async () => {
    const setFieldValue = vi.fn();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: false,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = {
      ...mockedAddressTemplate,
      elementDefaults: {},
    };

    await renderBirthAddressHierarchy({
      ...initialContextValues,
      setFieldValue,
      values: {
        ...mockInitialFormValues,
        birthAddress: {},
      },
    });

    expect(setFieldValue).not.toHaveBeenCalledWith('birthAddress.country', 'Perú');
  });

  it('clears the hidden UBIGEO metadata when the selected address path no longer matches visible fields', async () => {
    const setFieldValue = vi.fn();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: true,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: ['country', 'address1', 'stateProvince', 'countyDistrict', 'cityVillage'],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = mockedAddressTemplate;

    await renderAddressHierarchy({
      ...initialContextValues,
      setFieldValue,
      values: {
        ...mockInitialFormValues,
        address: {
          country: 'PERU',
          address1: 'UCAYALI',
          stateProvince: 'ATALAYA',
          countyDistrict: 'RAYMONDI',
          cityVillage: 'OTRO CENTRO POBLADO',
          [addressUbigeoField]: '2502010191',
          [addressUbigeoPathField]: ['PERU', 'UCAYALI', 'ATALAYA', 'RAYMONDI', 'AGUAJAL'].join(
            addressUbigeoPathSeparator,
          ),
        },
      },
    });

    await waitFor(() => {
      expect(setFieldValue).toHaveBeenCalledWith(`address.${addressUbigeoField}`, '', false);
      expect(setFieldValue).toHaveBeenCalledWith(`address.${addressUbigeoPathField}`, '', false);
    });
  });

  it('keeps hidden UBIGEO metadata when an escaped legacy path still matches visible fields', async () => {
    const setFieldValue = vi.fn();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: true,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: ['country', 'address1', 'stateProvince', 'countyDistrict', 'cityVillage'],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = mockedAddressTemplate;

    await renderAddressHierarchy({
      ...initialContextValues,
      setFieldValue,
      values: {
        ...mockInitialFormValues,
        address: {
          country: 'PERU',
          address1: 'UCAYALI',
          stateProvince: 'ATALAYA',
          countyDistrict: 'RAYMONDI',
          cityVillage: 'AGUAJAL',
          [addressUbigeoField]: '2502010191',
          [addressUbigeoPathField]: 'PERU &gt; UCAYALI &gt; ATALAYA &gt; RAYMONDI &gt; AGUAJAL',
        },
      },
    });

    expect(setFieldValue).not.toHaveBeenCalledWith(`address.${addressUbigeoField}`, '', false);
    expect(setFieldValue).not.toHaveBeenCalledWith(`address.${addressUbigeoPathField}`, '', false);
  });

  it('renders the address hierarchy fields in order if the address hierarchy feature is enabled', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = mockedAddressTemplate;

    renderAddressHierarchy(initialContextValues);

    const allFields = mockedAddressTemplate.lines.flat().filter(({ isToken }) => isToken === 'IS_ADDR_TOKEN');
    const orderMap = Object.fromEntries(mockedOrderedFields.map((field, indx) => [field, indx]));
    allFields.sort(
      (existingField1, existingField2) =>
        orderMap[existingField1.codeName ?? 0] - orderMap[existingField2.codeName ?? 0],
    );
    allFields.forEach((field) => {
      const textFieldInput = screen.getByLabelText(`${getExpectedAddressLabel(field)} (optional)`);
      expect(textFieldInput).toBeInTheDocument();
    });
  });

  it('renders the quick search bar above the address hierarchy fields when the address hierarchy feature is enabled and useQuickSearch is set to true', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: true,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = mockedAddressTemplate;

    renderAddressHierarchy(initialContextValues);

    const searchbox = screen.getByRole('searchbox', { name: /search address/i });
    expect(searchbox).toBeInTheDocument();
  });

  it('does not render the quick search without the address template fields', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: true,
            searchAddressByLevel: true,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: mockedOrderedFields,
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = undefined as unknown as AddressTemplate;
    mockResourcesContextValue.isLoadingAddressTemplate = true;

    renderAddressHierarchy(initialContextValues);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: /search address/i })).not.toBeInTheDocument();
  });

  it('renders quick search and address hierarchy fields together when both features are enabled', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: true,
            searchAddressByLevel: true,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: mockedOrderedFields,
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = mockedAddressTemplate;

    renderAddressHierarchy(initialContextValues);

    expect(screen.getByRole('searchbox', { name: /search address/i })).toBeInTheDocument();
    const allFields = mockedAddressTemplate.lines.flat().filter(({ isToken }) => isToken === 'IS_ADDR_TOKEN');
    allFields.forEach((field) => {
      expect(screen.getByLabelText(`${getExpectedAddressLabel(field)} (optional)`)).toBeInTheDocument();
    });
  });

  it('uses required fields from address hierarchy and displays their inline validation error', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: false,
            searchAddressByLevel: false,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: mockedOrderedFields,
      requiredFields: new Set(['country', 'stateProvince']),
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = {
      ...mockedAddressTemplate,
      requiredElements: null,
    };

    renderAddressHierarchy(initialContextValues);

    expect(screen.getByLabelText('Country')).toBeRequired();
    expect(screen.getByLabelText('Province')).toBeRequired();
    expect(screen.queryByLabelText('Country (optional)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Province (optional)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Population center (optional)')).not.toBeRequired();

    fireEvent.blur(screen.getByLabelText('Country'));

    expect(await screen.findByText('fieldRequired')).toBeInTheDocument();
  });

  it('displays inline validation errors for required address hierarchy comboboxes', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: false,
            searchAddressByLevel: true,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: mockedOrderedFields,
      requiredFields: new Set(['country']),
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = {
      ...mockedAddressTemplate,
      requiredElements: null,
    };

    renderAddressHierarchy(initialContextValues);
    fireEvent.blur(screen.getByLabelText('Country'));

    expect(await screen.findByText('fieldRequired')).toBeInTheDocument();
  });

  it('renders combobox fields when address hierarchy is enabled and searchAddressByLevel is set to true', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientRegistrationSchema),
      fieldConfigurations: {
        address: {
          useAddressHierarchy: {
            enabled: true,
            useQuickSearch: false,
            searchAddressByLevel: true,
          },
        },
      } as RegistrationConfig['fieldConfigurations'],
    });

    mockUseOrderedAddressHierarchyLevels.mockReturnValue({
      orderedFields: [],
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: undefined,
    });

    mockResourcesContextValue.addressTemplate = mockedAddressTemplate;

    renderAddressHierarchy(initialContextValues);

    const allFields = mockedAddressTemplate.lines.flat().filter(({ isToken }) => isToken === 'IS_ADDR_TOKEN');
    const orderMap = Object.fromEntries(mockedOrderedFields.map((field, indx) => [field, indx]));
    allFields.sort(
      (existingField1, existingField2) =>
        orderMap[existingField1.codeName ?? 0] - orderMap[existingField2.codeName ?? 0],
    );
    allFields.forEach((field) => {
      const textFieldInput = screen.getByLabelText(`${getExpectedAddressLabel(field)} (optional)`);
      expect(textFieldInput).toBeInTheDocument();
    });
  });
});
