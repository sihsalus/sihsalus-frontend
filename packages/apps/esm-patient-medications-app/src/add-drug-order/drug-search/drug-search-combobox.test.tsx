import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockDrugSearchResultApiData } from 'test-utils';
import { type ConfigObject, configSchema } from '../../config-schema';
import { type DrugSearchResult, useDrugSearch, useDrugTemplates } from './drug-search.resource';
import DrugSearchComboBox from './drug-search-combobox.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseDrugSearch = vi.mocked(useDrugSearch);
const mockUseDrugTemplates = vi.mocked(useDrugTemplates);

vi.mock('./drug-search.resource', async () => ({
  ...(await vi.importActual('./drug-search.resource')),
  useDrugSearch: vi.fn(),
  useDrugTemplates: vi.fn(),
}));

const mockSetSelectedDrugItem = vi.fn();

const drugWithoutDosageForm: DrugSearchResult = {
  uuid: '5219bdad-dfb2-4079-b6a2-1dcce2304058',
  display: '04058 - INMUNOGLOBULINA ANTI D 300 µg 2 mL',
  name: '04058 - INMUNOGLOBULINA ANTI D 300 µg 2 mL',
  strength: '300 µg 2 mL',
  dosageForm: null,
  concept: {
    display: 'INMUNOGLOBULINA ANTI D',
    uuid: 'a8a2e2cc-cf60-4c03-ab31-c90917b91f16',
  },
};

describe('DrugSearchComboBox', () => {
  beforeEach(() => {
    mockSetSelectedDrugItem.mockClear();
    mockUseConfig.mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as ConfigObject),
      minimumCharacterLengthForDrugSearch: 3,
    });

    mockUseDrugSearch.mockImplementation(() => ({
      isLoading: false,
      drugs: mockDrugSearchResultApiData,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    }));

    mockUseDrugTemplates.mockImplementation(() => ({
      isLoading: false,
      error: null,
      templateByDrugUuid: new Map(),
      isValidating: false,
      mutate: vi.fn(),
    }));
  });

  it('renders DrugSearchComboBox', async () => {
    const user = userEvent.setup();
    renderDrugSearchComboBox();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox'), 'Aspirin');
    const aspirin81 = screen.getByText(/Aspirin 81mg/i);
    expect(aspirin81).toBeInTheDocument();
    await user.click(aspirin81);
    expect(mockSetSelectedDrugItem).toHaveBeenCalledWith(
      expect.objectContaining({
        display: 'Aspirin 81mg',
      }),
    );
  });

  it('renders and selects a drug without dosage form', async () => {
    const user = userEvent.setup();

    mockUseDrugSearch.mockImplementation(() => ({
      isLoading: false,
      drugs: [drugWithoutDosageForm],
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    }));

    renderDrugSearchComboBox();

    await user.type(screen.getByRole('combobox'), 'INMUNOGLOBULINA');
    const immunoglobulin = screen.getByText(/04058 - INMUNOGLOBULINA ANTI D 300 µg 2 mL — 300 µg 2 ml/i);

    expect(immunoglobulin).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();

    await user.click(immunoglobulin);

    expect(mockSetSelectedDrugItem).toHaveBeenCalledWith(
      expect.objectContaining({
        display: drugWithoutDosageForm.display,
        drug: expect.objectContaining({
          dosageForm: null,
        }),
        quantityUnits: null,
        unit: null,
      }),
    );
  });

  it('does not search while the typed value is below the configured minimum length', async () => {
    const user = userEvent.setup();

    renderDrugSearchComboBox();
    await user.type(screen.getByRole('combobox'), 'as');

    expect(mockUseDrugSearch).not.toHaveBeenCalledWith('as');
  });
});

function renderDrugSearchComboBox() {
  render(
    <DrugSearchComboBox initialOrderBasketItem={null} setSelectedDrugItem={mockSetSelectedDrugItem} visit={null} />,
  );
}
