import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockAdvancedSearchResults } from 'test-utils';

import { configSchema, type PatientSearchConfig } from '../config-schema';
import { useInfinitePatientSearch } from '../patient-search.resource';
import { PatientSearchContext } from '../patient-search-context';
import { type PatientSearchResponse } from '../types';

import AdvancedPatientSearchComponent from './advanced-patient-search.component';
import { usePersonAttributeType } from './refine-search/person-attributes.resource';

const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);
const mockUseInfinitePatientSearch = vi.mocked(useInfinitePatientSearch);
const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);

vi.mock('../patient-search.resource', async () => ({
  useInfinitePatientSearch: vi.fn(),
}));

vi.mock('./refine-search/person-attributes.resource', async () => ({
  usePersonAttributeType: vi.fn(),
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: vi.fn(() => ({
    page: 1,
  })),
  useLocation: vi.fn(),
  useSearchParams: vi.fn(() => [
    {
      get: vi.fn(() => 'Jos'),
    },
  ]),
}));

const mockPatientActionContextValue = {
  nonNavigationSelectPatientAction: vi.fn(),
  selectPatientAction: vi.fn(),
};

const mockSearchResults: PatientSearchResponse = {
  isValidating: false,
  totalResults: 2,
  data: mockAdvancedSearchResults as unknown as PatientSearchResponse['data'],
  currentPage: 1,
  setPage: vi.fn(),
  hasMore: false,
  isLoading: false,
  fetchError: null as unknown as Error,
};

const personAttributeTypes: Record<string, { format: string; uuid: string; display: string }> = {
  '8b56eac7-5c76-4b9c-8c6f-1deab8d3fc47': {
    format: 'java.lang.String',
    uuid: '8b56eac7-5c76-4b9c-8c6f-1deab8d3fc47',
    display: 'Paciente No Identificado',
  },
  '4697d0e6-5b24-416b-aee6-708cd9a3a1db': {
    format: 'java.lang.String',
    uuid: '4697d0e6-5b24-416b-aee6-708cd9a3a1db',
    display: 'Nombre del Acompañante',
  },
  'a180fa5f-c44e-4490-a981-d7196b70c6ac': {
    format: 'java.lang.String',
    uuid: 'a180fa5f-c44e-4490-a981-d7196b70c6ac',
    display: 'Parentesco del Acompañante',
  },
};

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PatientSearchContext.Provider value={mockPatientActionContextValue}>{children}</PatientSearchContext.Provider>
);

describe('AdvancedPatientSearchComponent', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockUseInfinitePatientSearch.mockReturnValue(mockSearchResults);
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as PatientSearchConfig);
    mockUsePersonAttributeType.mockImplementation((attributeTypeUuid: string) => ({
      isLoading: false,
      error: undefined,
      data: personAttributeTypes[attributeTypeUuid],
    }));
  });

  const renderComponent = (props = {}) => {
    return render(
      <Wrapper>
        <AdvancedPatientSearchComponent query="Jos" {...props} />
      </Wrapper>,
    );
  };

  it('renders without crashing', () => {
    renderComponent();
    expect(screen.getByText('Refine search')).toBeInTheDocument();
  });

  it('displays search results correctly', () => {
    renderComponent();
    expect(screen.getByText(/2 search result/)).toBeInTheDocument();
  });

  it('does not show postcode or telephone filters by default', () => {
    renderComponent();

    expect(screen.queryByLabelText(/postcode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/telephone|tel[eé]fono|phone/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/nombre del acompa/i)).toBeInTheDocument();
  });

  describe('Filtering', () => {
    it('filters by gender correctly', async () => {
      renderComponent();

      await user.click(screen.getByRole('tab', { name: /female/i }));
      await user.click(screen.getByRole('button', { name: /apply/i }));

      expect(screen.getByText(/0 search result/)).toBeInTheDocument();
    });

    it('filters by age correctly', async () => {
      renderComponent();

      // Set age filter
      const ageInput = screen.getByRole('spinbutton', { name: /age/i });
      await user.type(ageInput, '30');
      await user.click(screen.getByRole('button', { name: /apply/i }));

      const patientBanners = screen.getAllByRole('banner');
      expect(patientBanners).toHaveLength(1);
      expect(within(patientBanners[0]).getByText(/Joseph Davis/i)).toBeInTheDocument();
    });

    it('filters by person attribute correctly', async () => {
      renderComponent();

      const responsibleInput = screen.getByLabelText(/nombre del acompa/i);
      await user.type(responsibleInput, 'SAMU');
      await user.click(screen.getByRole('button', { name: /apply/i }));

      const patientBanners = screen.getAllByRole('banner');
      expect(patientBanners).toHaveLength(1);
      expect(within(patientBanners[0]).getByText(/Joshua Johnson/)).toBeInTheDocument();
    });

    it('combines multiple filters correctly', async () => {
      renderComponent();

      // Set multiple filters
      await user.click(screen.getByRole('tab', { name: /any/i }));
      const ageInput = screen.getByRole('spinbutton', { name: /age/i });
      await user.type(ageInput, '5');
      await user.click(screen.getByRole('button', { name: /apply/i }));

      const patientBanners = screen.getAllByRole('banner');
      expect(patientBanners).toHaveLength(1);
      expect(within(patientBanners[0]).getByText(/Joshua Johnson/)).toBeInTheDocument();
    });

    it('resets filters correctly', async () => {
      renderComponent();

      // Set a filter
      await user.click(screen.getByRole('tab', { name: /female/i }));
      await user.click(screen.getByRole('button', { name: /apply/i }));

      // Reset filters
      await user.click(screen.getByRole('button', { name: /reset fields/i }));

      const patientBanners = screen.getAllByRole('banner');
      expect(patientBanners).toHaveLength(2);
    });
  });

  describe('Layout', () => {
    it('renders in desktop layout by default', () => {
      renderComponent();
      const container = screen.getByText(/Refine search/i);
      expect(container).toBeInTheDocument();
    });

    it('renders in tablet layout when specified', () => {
      renderComponent({ inTabletOrOverlay: true });
      const container = screen.getByText(/Refine search/i);
      expect(container).toBeInTheDocument();
    });
  });
});
