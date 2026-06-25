import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik, useFormikContext } from 'formik';
import { mockedAddressOptions, mockedAddressTemplate, mockedOrderedFields } from 'test-utils';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../../../../config-schema';
import { type Resources, ResourcesContext } from '../../../../offline.resources';
import {
  addressUbigeoField,
  addressUbigeoPathField,
  addressUbigeoPathSeparator,
} from '../../../patient-registration-utils';
import {
  type AddressHierarchySearchResult,
  useAddressHierarchy,
  useOrderedAddressHierarchyLevels,
} from '../address-hierarchy.resource';
import AddressSearchComponent from '../address-search.component';

type AddressSearchProps = React.ComponentProps<typeof AddressSearchComponent>;

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
    required: false,
  }));
const orderMap = Object.fromEntries(mockedOrderedFields.map((field, indx) => [field, indx]));
allFields.sort((existingField1, existingField2) => orderMap[existingField1.name] - orderMap[existingField2.name]);

async function renderAddressHierarchy(addressTemplate = mockedAddressTemplate, props?: Partial<AddressSearchProps>) {
  await render(
    <ResourcesContext.Provider value={{ addressTemplate } as Resources}>
      <Formik initialValues={{}} onSubmit={null}>
        <Form>
          <AddressSearchComponent addressLayout={allFields} {...props} />
        </Form>
      </Formik>
    </ResourcesContext.Provider>,
  );
}

const setFieldValue = vi.fn();
const separator = ' > ';

function buildAddressSearchResult(
  address: string,
  userGeneratedId?: string,
  addressFields: Array<{ name: string }> = allFields,
): AddressHierarchySearchResult {
  const values = address.split(separator);
  const segments = values.map((name, index) => ({
    addressField: addressFields[index]?.name,
    name,
    userGeneratedId: index === values.length - 1 ? userGeneratedId : undefined,
  }));

  return {
    display: address,
    fieldValues: Object.fromEntries(
      segments
        .filter((segment) => !!segment.addressField)
        .map((segment) => [segment.addressField as string, segment.name]),
    ),
    searchText: `${address} ${userGeneratedId ?? ''}`.toLowerCase(),
    segments,
    userGeneratedId,
  };
}

const mockedAddressSearchResults = mockedAddressOptions.map((address) => buildAddressSearchResult(address));

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
    expect(mockUseAddressHierarchy).toHaveBeenLastCalledWith(
      '',
      ' > ',
      allFields.map(({ name }) => name),
    );

    const ul = screen.queryByRole('list');
    expect(ul).not.toBeInTheDocument();
  });

  it("should render only the results for the search term matched address' parents", async () => {
    const user = userEvent.setup();

    mockUseAddressHierarchy.mockReturnValue({
      addresses: mockedAddressSearchResults,
      error: null,
      isLoading: false,
    });

    renderAddressHierarchy();

    const searchString = 'nea';
    const options = new Map<string, AddressHierarchySearchResult>();

    mockedAddressSearchResults.forEach((address) => {
      address.segments.forEach((segment, index) => {
        if (segment.name.toLowerCase().includes(searchString.toLowerCase())) {
          const segments = address.segments.slice(0, index + 1);
          const display = segments.map((currentSegment) => currentSegment.name).join(separator);
          options.set(display, {
            display,
            fieldValues: Object.fromEntries(
              segments
                .filter((currentSegment) => !!currentSegment.addressField)
                .map((currentSegment) => [currentSegment.addressField as string, currentSegment.name]),
            ),
            searchText: display.toLowerCase(),
            segments,
            userGeneratedId: segments[segments.length - 1]?.userGeneratedId,
          });
        }
      });
    });

    const addressOptions = [...options.values()];
    await user.type(screen.getByRole('searchbox'), searchString);

    for (const address of addressOptions) {
      const optionElement = await screen.findByText(address.display);
      expect(optionElement).toBeInTheDocument();
      await user.click(optionElement);
      await waitFor(() => {
        allFields.forEach(({ name }) => {
          expect(setFieldValue).toHaveBeenCalledWith(`address.${name}`, address.fieldValues[name] ?? '', false);
        });
      });
      await user.type(screen.getByRole('searchbox'), searchString);
    }
  });

  it('sets address values under the provided field prefix', async () => {
    const user = userEvent.setup();

    const addressLayout = [
      { id: 'country', name: 'country', label: 'Country', required: false },
      { id: 'address1', name: 'address1', label: 'Region', required: false },
    ];

    mockUseAddressHierarchy.mockReturnValue({
      addresses: [buildAddressSearchResult('Peru > Huancavelica', undefined, addressLayout)],
      error: null,
      isLoading: false,
    });

    renderAddressHierarchy(mockedAddressTemplate, { addressLayout, fieldPrefix: 'birthAddress' });

    await user.type(screen.getByRole('searchbox'), 'per');
    await user.click(await screen.findByRole('button', { name: 'Peru' }));

    await waitFor(() => {
      expect(setFieldValue).toHaveBeenCalledWith('birthAddress.country', 'Peru', false);
      expect(setFieldValue).toHaveBeenCalledWith('birthAddress.address1', '', false);
    });
  });

  it('stores the selected UBIGEO code and selected path behind the address fields', async () => {
    const user = userEvent.setup();
    const selectedAddress = 'PERU > UCAYALI > ATALAYA > RAYMONDI > AGUAJAL';

    mockUseAddressHierarchy.mockReturnValue({
      addresses: [buildAddressSearchResult(selectedAddress, '2502010191')],
      error: null,
      isLoading: false,
    });

    renderAddressHierarchy();

    await user.type(screen.getByRole('searchbox'), '2502010191');
    await user.click(await screen.findByRole('button', { name: `${selectedAddress} (2502010191)` }));

    await waitFor(() => {
      expect(setFieldValue).toHaveBeenCalledWith(`address.${addressUbigeoField}`, '2502010191', false);
      expect(setFieldValue).toHaveBeenCalledWith(
        `address.${addressUbigeoPathField}`,
        selectedAddress.split(separator).join(addressUbigeoPathSeparator),
        false,
      );
    });
  });
});
