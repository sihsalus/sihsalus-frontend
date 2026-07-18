import { getDefaultsFromConfigSchema, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { configSchema, type PatientSearchConfig } from '../../config-schema';

import {
  useAttributeConceptAnswers,
  useConfiguredAnswerConcepts,
  usePersonAttributeType,
} from './person-attributes.resource';
import RefineSearch from './refine-search.component';

const mockUseConfig = vi.mocked(useConfig);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);
const mockUseAttributeConceptAnswers = vi.mocked(useAttributeConceptAnswers);
const mockUseConfiguredAnswerConcepts = vi.mocked(useConfiguredAnswerConcepts);

vi.mock('./person-attributes.resource', () => ({
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

describe('RefineSearch', () => {
  const user = userEvent.setup();

  const mockSetFilters = vi.fn();
  const mockSetSearchQuery = vi.fn();
  const mockConfig = getDefaultsFromConfigSchema(configSchema) as PatientSearchConfig;
  const personAttributeTypes: Record<string, { format: string; uuid: string; display: string }> = {
    '6f5c0b8a-9e91-4d41-9a8c-8b0f3c2e7a11': {
      format: 'org.openmrs.Concept',
      uuid: '6f5c0b8a-9e91-4d41-9a8c-8b0f3c2e7a11',
      display: 'Tipo de Documento de Identidad',
    },
    'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d': {
      format: 'java.lang.String',
      uuid: 'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d',
      display: 'Número de Documento de Identidad',
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

  beforeEach(() => {
    mockSetFilters.mockClear();
    mockSetSearchQuery.mockClear();
    mockUseConfig.mockReturnValue(mockConfig);
    mockUseLayoutType.mockReturnValue('tablet');
    mockUsePersonAttributeType.mockImplementation((attributeTypeUuid: string) => ({
      isLoading: false,
      error: null,
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
      <RefineSearch
        setFilters={mockSetFilters}
        setSearchQuery={mockSetSearchQuery}
        inTabletOrOverlay={false}
        filtersApplied={0}
        {...props}
      />,
    );
  };

  it('renders all enabled search fields', () => {
    renderComponent();

    expect(screen.getByText('Sex')).toBeInTheDocument();
    expect(screen.queryByLabelText('Date of birth')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Age')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /active consultation/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Postcode')).not.toBeInTheDocument();
    expect(screen.queryByText('Tipo de Documento de Identidad')).not.toBeInTheDocument();
    expect(screen.queryByText('CÃ³digo de Documento de Identidad')).not.toBeInTheDocument();
    expect(screen.getByText('Estado de Verificación de Identidad')).toBeInTheDocument();
    expect(screen.getByText('Estado de Identificación en Admisión')).toBeInTheDocument();
  });

  it('shows number of filters applied in Search button when filters are active', () => {
    renderComponent({ filtersApplied: 2 });

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toHaveTextContent('Search (2 filters applied)');
  });

  it('requires at least three characters before searching', async () => {
    renderComponent();

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeDisabled();

    await user.type(screen.getByLabelText(/apellidos y nombres/i), 'Ah');
    expect(searchButton).toBeDisabled();
    expect(screen.getByText('Enter at least 3 characters')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/apellidos y nombres/i), 'u');
    expect(searchButton).toBeEnabled();
  });

  it('uses the shared patient search placeholder and submits an Otros document unchanged', async () => {
    renderComponent();

    const searchInput = screen.getByLabelText(/apellidos y nombres/i);
    expect(searchInput).toHaveAttribute('placeholder', 'Search for a patient by name or identifier number');
    expect(searchInput).toHaveAttribute('maxlength', '100');

    await user.type(searchInput, 'LM-OTRO-2026');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(mockSetSearchQuery).toHaveBeenCalledWith('LM-OTRO-2026');
  });

  it('calls setFilters with initial state when Reset Fields is clicked', async () => {
    renderComponent();

    await user.click(screen.getByRole('button', { name: /reset fields/i }));

    expect(mockSetFilters).toHaveBeenCalledWith({
      query: '',
      gender: 'any',
      postcode: '',
      age: null,
      ageUnit: 'years',
      hasActiveVisit: false,
      attributes: {},
    });
  });

  it('submits form with current state when Search is clicked', async () => {
    renderComponent();

    await user.type(screen.getByLabelText(/apellidos y nombres/i), 'Ahuanari');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Ahuanari',
        gender: 'any',
        postcode: '',
        attributes: {
          'a7e3f8c1-2d4b-4f9a-8c6e-1b2d3f4a5c6e': '',
          '787f1ea9-1792-45e5-9076-699b1a0638cb': '',
        },
        age: null,
        ageUnit: 'years',
        hasActiveVisit: false,
      }),
    );
  });

  describe('Layout rendering', () => {
    it('renders desktop layout by default', () => {
      renderComponent();

      expect(screen.getByRole('heading', { name: /refine search/i }).closest('form')).toHaveAttribute(
        'data-openmrs-role',
        'Refine Search',
      );
      expect(screen.queryByRole('button', { name: /refine search/i })).not.toBeInTheDocument();
    });

    it('renders tablet layout when inTabletOrOverlay is true', () => {
      mockUseLayoutType.mockReturnValue('tablet');
      renderComponent({ inTabletOrOverlay: true });

      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refine search/i })).toBeInTheDocument();
    });

    it('updates filter count in tablet mode', async () => {
      mockUseLayoutType.mockReturnValue('tablet');
      renderComponent({ inTabletOrOverlay: true, filtersApplied: 2 });

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText(/search queries added/i)).toBeInTheDocument();
    });
  });

  describe('Input handling', () => {
    it('handles gender selection correctly', async () => {
      renderComponent();

      await user.type(screen.getByLabelText(/apellidos y nombres/i), 'Ahuanari');
      await user.click(screen.getByRole('tab', { name: 'Male' }));
      await user.click(screen.getByRole('button', { name: /search/i }));

      expect(mockSetFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          gender: 'male',
        }),
      );
    });

    it('handles age and active consultation inputs correctly', async () => {
      renderComponent();

      await user.type(screen.getByLabelText(/apellidos y nombres/i), 'Ahuanari');
      fireEvent.change(screen.getByLabelText('Age'), { target: { value: '8' } });
      await user.selectOptions(screen.getByLabelText('Unit'), 'months');
      await user.click(screen.getByRole('checkbox', { name: /active consultation/i }));
      await user.click(screen.getByRole('button', { name: /search/i }));

      expect(mockSetFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          age: 8,
          ageUnit: 'months',
          hasActiveVisit: true,
        }),
      );
    });
  });
});
