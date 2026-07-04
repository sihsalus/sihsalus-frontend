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
import {
  useAttributeConceptAnswers,
  useConfiguredAnswerConcepts,
  usePersonAttributeType,
} from './refine-search/person-attributes.resource';

const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);
const mockUseInfinitePatientSearch = vi.mocked(useInfinitePatientSearch);
const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);
const mockUseAttributeConceptAnswers = vi.mocked(useAttributeConceptAnswers);
const mockUseConfiguredAnswerConcepts = vi.mocked(useConfiguredAnswerConcepts);

vi.mock('../patient-search.resource', async () => ({
  useInfinitePatientSearch: vi.fn(),
}));

vi.mock('./refine-search/person-attributes.resource', async () => ({
  usePersonAttributeType: vi.fn(),
  useAttributeConceptAnswers: vi.fn(),
  useConfiguredAnswerConcepts: vi.fn(),
}));

const conceptAnswersBySetUuid = {
  '0ee5c6c4-16d0-5952-b3b3-d3a098e184fa': [
    { uuid: 'f859ef8a-a7ca-5f74-b775-e19be71f5ba8', display: 'Documento Nacional de Identidad (DNI)' },
    { uuid: 'a0dd88f1-d1b6-4829-8a89-c7849b7c9a59', display: 'Carné de Extranjería' },
  ],
  'eae30f8f-02f7-497a-a9e6-5b6516301a6d': [
    { uuid: '01c97f73-9e7d-420c-bd08-3ba82e8cc825', display: 'Validado por RENIEC' },
    { uuid: '4ff1586e-2186-4820-bc98-2535ddfbcb33', display: 'No verificado' },
  ],
  'e47c3ef7-c7e2-4d35-b2fa-934df43df2a5': [
    { uuid: 'bdb57e2a-d8fd-4e2b-8622-1ba60dcd3024', display: 'No identificado' },
    { uuid: '9e42f0f1-d989-4604-902e-8a33f474f01e', display: 'Identificación confirmada' },
  ],
};

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
  '6f5c0b8a-9e91-4d41-9a8c-8b0f3c2e7a11': {
    format: 'org.openmrs.Concept',
    uuid: '6f5c0b8a-9e91-4d41-9a8c-8b0f3c2e7a11',
    display: 'Tipo de Documento de Identidad',
  },
  'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d': {
    format: 'java.lang.String',
    uuid: 'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d',
    display: 'Código de Documento de Identidad',
  },
  'a7e3f8c1-2d4b-4f9a-8c6e-1b2d3f4a5c6e': {
    format: 'org.openmrs.Concept',
    uuid: 'a7e3f8c1-2d4b-4f9a-8c6e-1b2d3f4a5c6e',
    display: 'Estado de Verificación de Identidad',
  },
  '787f1ea9-1792-45e5-9076-699b1a0638cb': {
    format: 'org.openmrs.Concept',
    uuid: '787f1ea9-1792-45e5-9076-699b1a0638cb',
    display: 'Estado de Identificación en Admisión',
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
    mockUseAttributeConceptAnswers.mockImplementation((conceptSetUuid: string) => ({
      conceptAnswers: conceptAnswersBySetUuid[conceptSetUuid] ?? [],
      isLoadingConceptAnswers: false,
      errorFetchingConceptAnswers: undefined,
    }));
    mockUseConfiguredAnswerConcepts.mockReturnValue({
      configuredConceptAnswers: [],
      isLoadingConfiguredAnswers: false,
    });
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
    expect(screen.getByLabelText(/código de documento de identidad/i)).toBeInTheDocument();
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

      const documentCodeInput = screen.getByLabelText(/código de documento de identidad/i);
      await user.type(documentCodeInput, '12345678');
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
