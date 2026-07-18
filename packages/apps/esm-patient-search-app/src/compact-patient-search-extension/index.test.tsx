import { getDefaultsFromConfigSchema, useConfig, useDebounce } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockAdvancedSearchResults } from 'test-utils';

import { configSchema, type PatientSearchConfig } from '../config-schema';
import { useInfinitePatientSearch } from '../patient-search.resource';

import CompactPatientSearchComponent from './index';

vi.mock('../patient-search.resource', () => ({
  useInfinitePatientSearch: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);
const mockUseDebounce = vi.mocked(useDebounce);
const mockUseInfinitePatientSearch = vi.mocked(useInfinitePatientSearch);

describe('compact patient search extension', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    mockUseDebounce.mockImplementation((value) => value);
    mockUseInfinitePatientSearch.mockReturnValue({
      currentPage: 1,
      data: [],
      fetchError: null,
      hasMore: false,
      isLoading: false,
      isValidating: false,
      setPage: vi.fn(),
      totalResults: 0,
    });
  });

  it('debounces and trims the query before searching', () => {
    render(<CompactPatientSearchComponent initialSearchTerm="  Rosa Elena  " />);

    expect(mockUseDebounce).toHaveBeenCalledWith('Rosa Elena');
    expect(mockUseInfinitePatientSearch).toHaveBeenCalledWith('Rosa Elena', true, true);
  });

  it('does not search a whitespace-only query', () => {
    render(<CompactPatientSearchComponent initialSearchTerm="   " />);

    expect(mockUseInfinitePatientSearch).toHaveBeenCalledWith('', true, false);
  });

  it('requires three characters and limits header searches to one hundred characters', async () => {
    const user = userEvent.setup();
    render(<CompactPatientSearchComponent initialSearchTerm="Jo" />);
    const searchbox = screen.getByRole('searchbox');

    expect(searchbox).toHaveAttribute('maxlength', '100');
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(mockUseInfinitePatientSearch).toHaveBeenLastCalledWith('Jo', true, false);

    await user.type(searchbox, 'h');
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
    expect(mockUseInfinitePatientSearch).toHaveBeenLastCalledWith('Joh', true, true);
  });

  it('selects the focused patient with ArrowDown and Enter', async () => {
    const user = userEvent.setup();
    const selectPatientAction = vi.fn();
    const patient = mockAdvancedSearchResults[0];
    mockUseInfinitePatientSearch.mockReturnValue({
      currentPage: 1,
      data: [patient] as unknown as ReturnType<typeof useInfinitePatientSearch>['data'],
      fetchError: null,
      hasMore: false,
      isLoading: false,
      isValidating: false,
      setPage: vi.fn(),
      totalResults: 1,
    });
    render(
      <CompactPatientSearchComponent
        initialSearchTerm="Joshua"
        selectPatientAction={selectPatientAction}
      />,
    );

    await user.click(screen.getByRole('searchbox'));
    await user.keyboard('{ArrowDown}{Enter}');

    expect(selectPatientAction).toHaveBeenCalledWith(patient.uuid);
  });

  it('hides previous results while a changed query is still debouncing', async () => {
    const user = userEvent.setup();
    const selectPatientAction = vi.fn();
    const patient = mockAdvancedSearchResults[0];
    mockUseDebounce.mockReturnValue('Joshua');
    mockUseInfinitePatientSearch.mockReturnValue({
      currentPage: 1,
      data: [patient] as unknown as ReturnType<typeof useInfinitePatientSearch>['data'],
      fetchError: null,
      hasMore: false,
      isLoading: false,
      isValidating: false,
      setPage: vi.fn(),
      totalResults: 1,
    });
    render(
      <CompactPatientSearchComponent
        initialSearchTerm="Joshua"
        selectPatientAction={selectPatientAction}
      />,
    );
    const searchbox = screen.getByRole('searchbox');

    expect(screen.getByRole('button', { name: patient.person.personName.display })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    await user.click(searchbox);
    await user.clear(searchbox);
    await user.type(searchbox, 'Maria');

    expect(screen.queryByRole('button', { name: patient.person.personName.display })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(selectPatientAction).not.toHaveBeenCalled();
    expect(mockUseInfinitePatientSearch).toHaveBeenLastCalledWith('Joshua', true, false);
  });

  it('removes previous results immediately when the query is cleared', async () => {
    const user = userEvent.setup();
    const patient = mockAdvancedSearchResults[0];
    mockUseDebounce.mockReturnValue('Joshua');
    mockUseInfinitePatientSearch.mockReturnValue({
      currentPage: 1,
      data: [patient] as unknown as ReturnType<typeof useInfinitePatientSearch>['data'],
      fetchError: null,
      hasMore: false,
      isLoading: false,
      isValidating: false,
      setPage: vi.fn(),
      totalResults: 1,
    });
    render(<CompactPatientSearchComponent initialSearchTerm="Joshua" selectPatientAction={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(screen.queryByRole('button', { name: patient.person.personName.display })).not.toBeInTheDocument();
    expect(mockUseInfinitePatientSearch).toHaveBeenLastCalledWith('Joshua', true, false);
  });
});
