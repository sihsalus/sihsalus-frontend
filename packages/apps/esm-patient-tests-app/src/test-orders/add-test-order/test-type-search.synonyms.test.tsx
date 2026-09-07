import { getDefaultsFromConfigSchema, useConfig, useSession } from '@openmrs/esm-framework';
import { useOrderBasket } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSessionDataResponse } from 'test-utils';
import { type ConfigObject, configSchema } from '../../config-schema';
import { TestTypeSearch } from './test-type-search.component';
import { useTestTypes } from './useTestTypes';

vi.mock('./useTestTypes', () => ({ useTestTypes: vi.fn() }));
vi.mock('swr/immutable', () => ({
  default: () => ({
    data: [{ uuid: 'synthetic-lab-subset', display: 'Hematology' }],
    isLoading: false,
  }),
}));
vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useOrderBasket: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseSession = vi.mocked(useSession);
const mockUseTestTypes = vi.mocked(useTestTypes);
const mockUseOrderBasket = vi.mocked(useOrderBasket);
const mockSetOrders = vi.fn();
const mockOpenForm = vi.fn();
const testType = {
  conceptUuid: 'synthetic-hematocrit',
  label: 'Prueba de hematocrito',
  synonyms: ['Hto'],
  matchedName: 'Hto',
};

beforeEach(() => {
  mockSetOrders.mockClear();
  mockOpenForm.mockClear();
  mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ConfigObject);
  mockUseSession.mockReturnValue(mockSessionDataResponse.data);
  mockUseTestTypes.mockReturnValue({
    testTypes: [testType],
    isLoading: false,
    error: null,
  });
  mockUseOrderBasket.mockReturnValue({
    orders: [],
    setOrders: mockSetOrders,
  } as ReturnType<typeof useOrderBasket>);
});

function renderPicker() {
  return render(
    <TestTypeSearch
      openLabForm={mockOpenForm}
      orderTypeUuid="synthetic-lab-order-type"
      orderableConceptSets={['synthetic-lab-root']}
      returnToOrderBasket={vi.fn()}
    />,
  );
}

it('shows the matching synonym alongside the original name and keeps its UUID', async () => {
  const user = userEvent.setup();
  renderPicker();
  expect(screen.getByText('Catalog name: Hto')).toBeInTheDocument();
  expect(screen.getByText('Prueba de hematocrito')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^Order form/ }));
  expect(mockOpenForm).toHaveBeenCalledWith(
    expect.objectContaining({
      testType: expect.objectContaining({
        conceptUuid: 'synthetic-hematocrit',
      }),
    }),
  );
  expect(mockSetOrders).not.toHaveBeenCalled();
});

it('requires opening the order form for spelling suggestions and prevents bulk addition', async () => {
  const user = userEvent.setup();
  mockUseTestTypes.mockReturnValue({
    testTypes: [{ ...testType, approximateMatch: true }],
    isLoading: false,
    error: null,
  });
  renderPicker();
  await user.selectOptions(screen.getByRole('combobox'), 'synthetic-lab-subset');
  expect(screen.getByRole('status')).toHaveTextContent('Similar catalog names');
  expect(screen.queryByRole('button', { name: /^Add to basket/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Agregar todos/ })).not.toBeInTheDocument();
  expect(mockSetOrders).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: /^Order form/ }));
  expect(mockOpenForm).toHaveBeenCalledTimes(1);
});
