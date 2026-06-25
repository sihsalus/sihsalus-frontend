import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFhirPatient } from 'test-utils';
import { type ConfigObject, configSchema } from '../../config-schema';
import DrugSearch from './drug-search.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockOpenOrderForm = vi.fn();
const mockCloseWorkspace = vi.fn();
const mockOnSearchTermChange = vi.fn();

vi.mock('./order-basket-search-results.component', () => ({
  default: ({ searchTerm }: { searchTerm: string }) => <div data-testid="drug-search-term">{searchTerm}</div>,
}));

const renderDrugSearch = (searchTerm = '') =>
  render(
    <DrugSearch
      openOrderForm={mockOpenOrderForm}
      closeWorkspace={mockCloseWorkspace}
      patient={mockFhirPatient}
      visit={null}
      searchTerm={searchTerm}
      onSearchTermChange={mockOnSearchTermChange}
    />,
  );

describe('DrugSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as ConfigObject),
      minimumCharacterLengthForDrugSearch: 3,
    });
  });

  it('does not pass short search terms to the results query', () => {
    renderDrugSearch('as');

    expect(screen.getByTestId('drug-search-term')).toHaveTextContent('');
  });

  it('passes search terms that meet the configured minimum length', () => {
    renderDrugSearch('asp');

    expect(screen.getByTestId('drug-search-term')).toHaveTextContent('asp');
  });

  it('trims search terms before querying', () => {
    renderDrugSearch('  aspirin  ');

    expect(screen.getByTestId('drug-search-term')).toHaveTextContent('aspirin');
  });

  it('calls onSearchTermChange when the user types', async () => {
    const user = userEvent.setup();

    renderDrugSearch();
    await user.type(screen.getByRole('searchbox'), 'asp');

    expect(mockOnSearchTermChange).toHaveBeenCalled();
  });
});
