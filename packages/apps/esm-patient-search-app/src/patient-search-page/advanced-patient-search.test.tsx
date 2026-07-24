import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockAdvancedSearchResults } from 'test-utils';

import { configSchema, type PatientSearchConfig } from '../config-schema';
import { useActiveVisitPatientUuids, useInfinitePatientSearch } from '../patient-search.resource';
import { PatientSearchContext } from '../patient-search-context';
import { type PatientSearchResponse } from '../types';

import AdvancedPatientSearchComponent from './advanced-patient-search.component';
import { getPatientAgeForUnit } from './patient-age-filter';
import {
  useAttributeConceptAnswers,
  useConfiguredAnswerConcepts,
  usePersonAttributeType,
} from './refine-search/person-attributes.resource';

const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);
const mockUseInfinitePatientSearch = vi.mocked(useInfinitePatientSearch);
const mockUseActiveVisitPatientUuids = vi.mocked(useActiveVisitPatientUuids);
const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);
const mockUseAttributeConceptAnswers = vi.mocked(useAttributeConceptAnswers);
const mockUseConfiguredAnswerConcepts = vi.mocked(useConfiguredAnswerConcepts);

vi.mock('../patient-search.resource', async () => ({
  useInfinitePatientSearch: vi.fn(),
  useActiveVisitPatientUuids: vi.fn(),
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
    { uuid: '8e9518a2-828d-4e50-a110-d964b63e51e2', display: 'Fusionado con registro existente' },
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
    mockUseActiveVisitPatientUuids.mockReturnValue({
      patientUuids: new Set(),
      error: undefined,
      isLoading: false,
    });
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

  it('uses the configured deceased-patient search policy', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      includeDead: false,
    } as PatientSearchConfig);

    renderComponent();

    expect(mockUseInfinitePatientSearch).toHaveBeenCalledWith('Jos', false, true, 50);
  });

  it('keeps fetching server pages while the last page reports more results', () => {
    const setPage = vi.fn();
    mockUseInfinitePatientSearch.mockReturnValue({ ...mockSearchResults, hasMore: true, setPage });

    renderComponent();

    expect(setPage).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a page is still loading', { isLoading: true }],
    ['a page is validating', { isValidating: true }],
    ['a page failed to fetch', { fetchError: new Error('SQL timeout') }],
  ])('does not request another server page while %s', (_description, state) => {
    const setPage = vi.fn();
    mockUseInfinitePatientSearch.mockReturnValue({ ...mockSearchResults, hasMore: true, setPage, ...state });

    renderComponent();

    expect(setPage).not.toHaveBeenCalled();
  });

  it('does not offer patient registration in an embedded selection context', () => {
    mockUseInfinitePatientSearch.mockReturnValue({
      ...mockSearchResults,
      data: [],
      totalResults: 0,
    });

    renderComponent();

    expect(screen.getByText(/no patient charts were found/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add patient/i })).not.toBeInTheDocument();
  });

  it('shows age and status filters without redundant document filters', () => {
    renderComponent();

    expect(screen.queryByLabelText(/postcode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/telephone|tel[eé]fono|phone/i)).not.toBeInTheDocument();
    expect(screen.queryByText('CÃ³digo de Documento de Identidad')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/age/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /consultation status/i })).toHaveValue('any');
  });

  describe('Filtering', () => {
    it('filters by gender correctly', async () => {
      renderComponent();

      await user.click(screen.getByRole('tab', { name: /female/i }));
      await user.click(screen.getByRole('button', { name: /search/i }));

      expect(screen.getByText(/0 search result/)).toBeInTheDocument();
    });

    it('filters exact patient age in completed years', async () => {
      renderComponent();

      const expectedAge = getPatientAgeForUnit(mockAdvancedSearchResults[0].person.birthdate, 'years');
      fireEvent.change(screen.getByLabelText(/age/i), { target: { value: String(expectedAge) } });
      await user.click(screen.getByRole('button', { name: /search/i }));

      const patientBanners = screen.getAllByRole('banner');
      expect(patientBanners).toHaveLength(1);
      expect(within(patientBanners[0]).getByText(/Joshua Johnson/i)).toBeInTheDocument();
    });

    it('filters identity verification status correctly', async () => {
      renderComponent();

      await user.click(screen.getByRole('combobox', { name: /estado de verificaci.n de identidad/i }));
      await user.click(screen.getByRole('option', { name: 'Validado por RENIEC' }));
      await user.click(screen.getByRole('button', { name: /search/i }));

      const patientBanners = screen.getAllByRole('banner');
      expect(patientBanners).toHaveLength(1);
      expect(within(patientBanners[0]).getByText(/Joshua Johnson/)).toBeInTheDocument();
    });

    it('filters admission identification status across concept and legacy values', async () => {
      const admissionStatusAttributeType = {
        uuid: '787f1ea9-1792-45e5-9076-699b1a0638cb',
        display: 'Estado de Identificación en Admisión',
      };
      const patients = [
        {
          ...mockAdvancedSearchResults[0],
          uuid: 'merged-concept-patient',
          attributes: [
            ...mockAdvancedSearchResults[0].attributes.filter(
              ({ attributeType }) => attributeType.uuid !== admissionStatusAttributeType.uuid,
            ),
            {
              value: {
                uuid: '8e9518a2-828d-4e50-a110-d964b63e51e2',
                display: 'Fusionado con registro existente',
              },
              attributeType: admissionStatusAttributeType,
            },
          ],
        },
        {
          ...mockAdvancedSearchResults[1],
          uuid: 'merged-legacy-patient',
          attributes: [
            ...mockAdvancedSearchResults[1].attributes.filter(
              ({ attributeType }) => attributeType.uuid !== admissionStatusAttributeType.uuid,
            ),
            { value: 'merged', attributeType: admissionStatusAttributeType },
          ],
        },
        {
          ...mockAdvancedSearchResults[0],
          uuid: 'missing-status-value-patient',
          attributes: [
            ...mockAdvancedSearchResults[0].attributes.filter(
              ({ attributeType }) => attributeType.uuid !== admissionStatusAttributeType.uuid,
            ),
            { value: null, attributeType: admissionStatusAttributeType },
          ],
        },
        {
          ...mockAdvancedSearchResults[0],
          uuid: 'malformed-attribute-patient',
          attributes: [null, { value: {}, attributeType: null }],
        },
      ] as unknown as NonNullable<PatientSearchResponse['data']>;
      mockUseInfinitePatientSearch.mockReturnValue({ ...mockSearchResults, data: patients, totalResults: 4 });

      renderComponent();

      await user.click(screen.getByRole('combobox', { name: /estado de identificaci.n en admisi.n/i }));
      await user.click(screen.getByRole('option', { name: 'Fusionado con registro existente' }));
      await user.click(screen.getByRole('button', { name: /search/i }));

      expect(screen.getByText(/2 search result/)).toBeInTheDocument();
      expect(screen.getAllByRole('banner')).toHaveLength(2);
    });

    it('combines multiple filters correctly', async () => {
      renderComponent();

      await user.click(screen.getByRole('tab', { name: /^male$/i }));
      const expectedAge = getPatientAgeForUnit(mockAdvancedSearchResults[0].person.birthdate, 'years');
      fireEvent.change(screen.getByLabelText(/age/i), { target: { value: String(expectedAge) } });
      await user.click(screen.getByRole('button', { name: /search/i }));

      const patientBanners = screen.getAllByRole('banner');
      expect(patientBanners).toHaveLength(1);
      expect(within(patientBanners[0]).getByText(/Joshua Johnson/)).toBeInTheDocument();
    });

    it('filters patients that have an active consultation', async () => {
      mockUseActiveVisitPatientUuids.mockReturnValue({
        patientUuids: new Set([mockAdvancedSearchResults[0].uuid]),
        error: undefined,
        isLoading: false,
      });
      renderComponent();

      await user.selectOptions(screen.getByRole('combobox', { name: /consultation status/i }), 'active');
      await user.click(screen.getByRole('button', { name: /search/i }));

      const patientBanners = screen.getAllByRole('banner');
      expect(patientBanners).toHaveLength(1);
      expect(within(patientBanners[0]).getByText(/Joshua Johnson/)).toBeInTheDocument();
    });

    it('filters patients that do not have an active consultation', async () => {
      mockUseActiveVisitPatientUuids.mockReturnValue({
        patientUuids: new Set([mockAdvancedSearchResults[0].uuid]),
        error: undefined,
        isLoading: false,
      });
      renderComponent();

      await user.selectOptions(screen.getByRole('combobox', { name: /consultation status/i }), 'inactive');
      await user.click(screen.getByRole('button', { name: /search/i }));

      const patientBanners = screen.getAllByRole('banner');
      expect(patientBanners).toHaveLength(1);
      expect(within(patientBanners[0]).getByText(/Joseph Davis/)).toBeInTheDocument();
    });

    it('resets filters correctly', async () => {
      renderComponent();

      // Set a filter
      await user.click(screen.getByRole('tab', { name: /female/i }));
      await user.click(screen.getByRole('button', { name: /search/i }));

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
