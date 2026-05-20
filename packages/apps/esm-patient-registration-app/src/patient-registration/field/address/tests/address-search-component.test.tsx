import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik, useFormikContext } from 'formik';
import { mockedAddressOptions, mockedAddressTemplate, mockedOrderedFields } from 'test-utils';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../../../../config-schema';
import { type Resources, ResourcesContext } from '../../../../offline.resources';
import { PatientRegistrationContext } from '../../../patient-registration-context';
import { useAddressHierarchy, useOrderedAddressHierarchyLevels } from '../address-hierarchy.resource';
import AddressSearchComponent from '../address-search.component';

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);
const mockUseAddressHierarchy = vi.mocked(useAddressHierarchy);
const mockUseOrderedAddressHierarchyLevels = vi.mocked(useOrderedAddressHierarchyLevels);
const mockUseFormikContext = useFormikContext as vi.Mock;

vi.mock('../address-hierarchy.resource', async () => ({
  ...((await vi.importActual('../address-hierarchy.resource')) as vi.Mock),
  useOrderedAddressHierarchyLevels: vi.fn(),
  useAddressHierarchy: vi.fn(),
}));

vi.mock('../../../patient-registration.resource', async () => ({
  ...((await vi.importActual('../../../../patient-registration.resource')) as vi.Mock),
  useAddressHierarchy: vi.fn(),
}));

vi.mock('formik', async () => ({
  ...((await vi.importActual('formik')) as vi.Mock),
  useFormikContext: vi.fn(() => ({})),
}));

const allFields = mockedAddressTemplate.lines
  .flat()
  .filter((field) => field.isToken === 'IS_ADDR_TOKEN')
  .map(({ codeName, displayText }) => ({
    id: codeName,
    name: codeName,
    label: displayText,
  }));
const orderMap = Object.fromEntries(mockedOrderedFields.map((field, indx) => [field, indx]));
allFields.sort((existingField1, existingField2) => orderMap[existingField1.name] - orderMap[existingField2.name]);

async function renderAddressHierarchy(addressTemplate = mockedAddressTemplate) {
  await render(
    <ResourcesContext.Provider value={{ addressTemplate } as Resources}>
      <Formik initialValues={{}} onSubmit={null}>
        <Form>
          <PatientRegistrationContext.Provider value={{ setFieldValue: vi.fn() } as any}>
            <AddressSearchComponent addressLayout={allFields} />
          </PatientRegistrationContext.Provider>
        </Form>
      </Formik>
    </ResourcesContext.Provider>,
  );
}

const setFieldValue = vi.fn();

describe('Testing address search bar', () => {
  beforeEach(() => {
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
      orderedFields: mockedOrderedFields,
      isLoadingFieldOrder: false,
      errorFetchingFieldOrder: null,
    });
    mockUseFormikContext.mockReturnValue({
      setFieldValue,
    });
  });

  it('should render the search bar', () => {
    mockUseAddressHierarchy.mockReturnValue({
      addresses: [],
      error: null,
      isLoading: false,
    });

    renderAddressHierarchy();

    const searchbox = screen.getByRole('searchbox');
    expect(searchbox).toBeInTheDocument();

    const ul = screen.queryByRole('list');
    expect(ul).not.toBeInTheDocument();
  });

  it("should render only the results for the search term matched address' parents", async () => {
    const user = userEvent.setup();

    mockUseAddressHierarchy.mockReturnValue({
      addresses: mockedAddressOptions,
      error: null,
      isLoading: false,
    });

    renderAddressHierarchy();

    const searchString = 'nea';
    const separator = ' > ';
    const options: Set<string> = new Set();

    mockedAddressOptions.forEach((address) => {
      const values = address.split(separator);
      values.forEach((val, index) => {
        if (val.toLowerCase().includes(searchString.toLowerCase())) {
          options.add(values.slice(0, index + 1).join(separator));
        }
      });
    });

    const addressOptions = [...options];
    await user.type(screen.getByRole('searchbox'), searchString);

    for (const address of addressOptions) {
      const optionElement = await screen.findByText(address);
      expect(optionElement).toBeInTheDocument();
      await user.click(optionElement);
      const values = address.split(separator);
      await waitFor(() => {
        allFields.forEach(({ name }, index) => {
          expect(setFieldValue).toHaveBeenCalledWith(`address.${name}`, values?.[index] ?? '', false);
        });
      });
      await user.type(screen.getByRole('searchbox'), searchString);
    }
  });
});
