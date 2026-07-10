import { getDefaultsFromConfigSchema, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Day of Birth')).toBeInTheDocument();
    expect(screen.getByText('Month of Birth')).toBeInTheDocument();
    expect(screen.getByText('Year of Birth')).toBeInTheDocument();
    expect(screen.getByLabelText('Age')).toBeInTheDocument();
    expect(screen.queryByLabelText('Postcode')).not.toBeInTheDocument();
    expect(screen.getByText('Tipo de Documento de Identidad')).toBeInTheDocument();
    expect(screen.getByLabelText('Número de Documento de Identidad')).toBeInTheDocument();
    expect(screen.getByText('Estado de Verificación de Identidad')).toBeInTheDocument();
    expect(screen.getByText('Estado de Identificación en Admisión')).toBeInTheDocument();
  });

  it('shows number of filters applied in Search button when filters are active', () => {
    renderComponent({ filtersApplied: 2 });

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toHaveTextContent('Search (2 filters applied)');
  });

  it('calls setFilters with initial state when Reset Fields is clicked', async () => {
    renderComponent();

    await user.click(screen.getByRole('button', { name: /reset fields/i }));

    expect(mockSetFilters).toHaveBeenCalledWith({
      query: '',
      gender: 'any',
      dateOfBirth: 0,
      monthOfBirth: 0,
      yearOfBirth: 0,
      postcode: '',
      age: 0,
      attributes: {},
    });
  });

  it('submits form with current state when Search is clicked', async () => {
    renderComponent();

    const ageInput = screen.getByRole('spinbutton', { name: /age/i });
    await user.type(ageInput, '30');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '',
        gender: 'any',
        dateOfBirth: 0,
        monthOfBirth: 0,
        yearOfBirth: 0,
        postcode: '',
        attributes: {
          '6f5c0b8a-9e91-4d41-9a8c-8b0f3c2e7a11': '',
          'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d': '',
          'a7e3f8c1-2d4b-4f9a-8c6e-1b2d3f4a5c6e': '',
          '787f1ea9-1792-45e5-9076-699b1a0638cb': '',
        },
        age: 30,
      }),
    );
  });

  it('uses the identity document number as the search query when the main query is empty', async () => {
    renderComponent();

    await user.type(screen.getByLabelText('Número de Documento de Identidad'), '10000001');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(mockSetSearchQuery).toHaveBeenCalledWith('10000001');
    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '',
        attributes: expect.objectContaining({
          'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d': '10000001',
        }),
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

      await user.click(screen.getByRole('tab', { name: 'Male' }));
      await user.click(screen.getByRole('button', { name: /search/i }));

      expect(mockSetFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          gender: 'male',
        }),
      );
    });

    it('handles date of birth inputs correctly', async () => {
      renderComponent();

      const dayInput = screen.getByRole('spinbutton', { name: /day of birth/i });
      const monthInput = screen.getByRole('spinbutton', { name: /month of birth/i });
      const yearInput = screen.getByRole('spinbutton', { name: /year of birth/i });

      await user.type(dayInput, '15');
      await user.type(monthInput, '03');
      await user.type(yearInput, '1990');
      await user.click(screen.getByRole('button', { name: /search/i }));

      expect(mockSetFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          dateOfBirth: 15,
          monthOfBirth: 3,
          yearOfBirth: 1990,
        }),
      );
    });

    it('validates date of birth inputs', async () => {
      renderComponent();

      const dayInput = screen.getByRole('spinbutton', { name: /day of birth/i });
      const monthInput = screen.getByRole('spinbutton', { name: /month of birth/i });

      await user.type(dayInput, '32');
      expect(dayInput).toHaveAttribute('max', '31');

      await user.type(monthInput, '13');
      expect(monthInput).toHaveAttribute('max', '12');
    });
  });
});
