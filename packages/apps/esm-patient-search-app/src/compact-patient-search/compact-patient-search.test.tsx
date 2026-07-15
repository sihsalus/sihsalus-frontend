import { getDefaultsFromConfigSchema, navigate, useConfig, useDebounce, useSession } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession, renderWithRouter } from 'test-utils';

import { configSchema, type PatientSearchConfig } from '../config-schema';

import CompactPatientSearchComponent from './compact-patient-search.component';

const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);
const mockUseDebounce = vi.mocked(useDebounce);
const mockUseSession = vi.mocked(useSession);
const mockNavigate = vi.mocked(navigate);

describe('CompactPatientSearchComponent', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    mockUseDebounce.mockImplementation((value) => value);
    mockUseSession.mockReturnValue(mockSession.data);
  });

  it('renders a compact search bar', () => {
    renderWithRouter(CompactPatientSearchComponent, { isSearchPage: false, initialSearchTerm: '' });

    expect(screen.getByPlaceholderText(/Search for a patient by name or identifier number/i)).toBeInTheDocument();
  });

  it('renders search results when search term is not empty', async () => {
    const user = userEvent.setup();

    renderWithRouter(CompactPatientSearchComponent, { isSearchPage: false, initialSearchTerm: '' });

    const searchbox = screen.getByPlaceholderText(/Search for a patient by name or identifier number/i);

    await user.type(searchbox, 'John');

    const searchResultsContainer = screen.getByTestId('floatingSearchResultsContainer');
    expect(searchResultsContainer).toBeInTheDocument();
  });

  it('renders a list of recently searched patients when a search term is not provided and the showRecentlySearchedPatients config property is set', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      search: {
        showRecentlySearchedPatients: true,
        disableTabletSearchOnKeyUp: true,
      } as PatientSearchConfig['search'],
    });

    renderWithRouter(CompactPatientSearchComponent, { isSearchPage: false, initialSearchTerm: '' });

    const searchResultsContainer = screen.getByTestId('floatingSearchResultsContainer');
    expect(searchResultsContainer).toBeInTheDocument();
  });

  it('navigates to the advanced search page with the correct query string when the Search button is clicked', async () => {
    const user = userEvent.setup();

    renderWithRouter(CompactPatientSearchComponent, {
      isSearchPage: false,
      initialSearchTerm: '',
      shouldNavigateToPatientSearchPage: true,
    });

    const searchbox = screen.getByRole('searchbox');

    await user.type(searchbox, 'John');

    const searchButton = screen.getByRole('button', { name: /search/i });

    await user.click(searchButton);

    expect(mockNavigate).toHaveBeenCalledWith({ to: expect.stringMatching(/.*\/search\?query=John/) });
  });

  it('navigates using the submitted search term even before the debounced value catches up', async () => {
    const user = userEvent.setup();
    mockUseDebounce.mockReturnValue('');

    renderWithRouter(CompactPatientSearchComponent, {
      isSearchPage: true,
      initialSearchTerm: '',
      shouldNavigateToPatientSearchPage: true,
    });

    const searchbox = screen.getByRole('searchbox');

    await user.type(searchbox, '80526377');
    await user.keyboard('{Enter}');

    expect(mockNavigate).toHaveBeenCalledWith({ to: expect.stringMatching(/.*\/search\?query=80526377/) });
  });

  it('hides results from the previous query while the new query is debouncing', async () => {
    const user = userEvent.setup();
    const config = getDefaultsFromConfigSchema(configSchema) as PatientSearchConfig;
    mockUseConfig.mockReturnValue({
      ...config,
      search: { ...config.search, showRecentlySearchedPatients: false },
    });
    mockUseDebounce.mockReturnValue('John');
    renderWithRouter(CompactPatientSearchComponent, {
      isSearchPage: false,
      initialSearchTerm: 'John',
    });
    const searchbox = screen.getByRole('searchbox');

    expect(screen.getByTestId('floatingSearchResultsContainer')).toBeInTheDocument();
    await user.clear(searchbox);
    await user.type(searchbox, 'Jane');

    expect(screen.queryByTestId('floatingSearchResultsContainer')).not.toBeInTheDocument();
  });

  it('removes search results immediately when the query is cleared', async () => {
    const user = userEvent.setup();
    const config = getDefaultsFromConfigSchema(configSchema) as PatientSearchConfig;
    mockUseConfig.mockReturnValue({
      ...config,
      search: { ...config.search, showRecentlySearchedPatients: false },
    });
    mockUseDebounce.mockReturnValue('John');
    renderWithRouter(CompactPatientSearchComponent, {
      isSearchPage: false,
      initialSearchTerm: 'John',
    });

    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(screen.queryByTestId('floatingSearchResultsContainer')).not.toBeInTheDocument();
  });
});
