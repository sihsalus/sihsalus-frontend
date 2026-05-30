import { getDefaultsFromConfigSchema, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { configSchema, type PatientSearchConfig } from '../../config-schema';

import { usePersonAttributeType } from './person-attributes.resource';
import RefineSearch from './refine-search.component';

const mockUseConfig = vi.mocked(useConfig);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);

vi.mock('./person-attributes.resource', () => ({
  usePersonAttributeType: vi.fn(),
}));

describe('RefineSearch', () => {
  const user = userEvent.setup();

  const mockSetFilters = vi.fn();
  const mockConfig = getDefaultsFromConfigSchema(configSchema) as PatientSearchConfig;
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

  beforeEach(() => {
    mockUseConfig.mockReturnValue(mockConfig);
    mockUseLayoutType.mockReturnValue('tablet');
    mockUsePersonAttributeType.mockImplementation((attributeTypeUuid: string) => ({
      isLoading: false,
      error: null,
      data: personAttributeTypes[attributeTypeUuid],
    }));
  });

  const renderComponent = (props = {}) => {
    return render(<RefineSearch setFilters={mockSetFilters} inTabletOrOverlay={false} filtersApplied={0} {...props} />);
  };

  it('renders all enabled search fields', () => {
    renderComponent();

    expect(screen.getByText('Sex')).toBeInTheDocument();
    expect(screen.getByText('Day of Birth')).toBeInTheDocument();
    expect(screen.getByText('Month of Birth')).toBeInTheDocument();
    expect(screen.getByText('Year of Birth')).toBeInTheDocument();
    expect(screen.getByLabelText('Age')).toBeInTheDocument();
    expect(screen.queryByLabelText('Postcode')).not.toBeInTheDocument();
    expect(screen.getByText('Paciente No Identificado')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del Acompañante')).toBeInTheDocument();
    expect(screen.getByLabelText('Parentesco del Acompañante')).toBeInTheDocument();
  });

  it('shows number of filters applied in Apply button when filters are active', () => {
    renderComponent({ filtersApplied: 2 });

    const applyButton = screen.getByRole('button', { name: /apply/i });
    expect(applyButton).toHaveTextContent('Apply (2 filters applied)');
  });

  it('calls setFilters with initial state when Reset Fields is clicked', async () => {
    renderComponent();

    await user.click(screen.getByRole('button', { name: /reset fields/i }));

    expect(mockSetFilters).toHaveBeenCalledWith({
      gender: 'any',
      dateOfBirth: 0,
      monthOfBirth: 0,
      yearOfBirth: 0,
      postcode: '',
      age: 0,
      attributes: {},
    });
  });

  it('submits form with current state when Apply is clicked', async () => {
    renderComponent();

    const ageInput = screen.getByRole('spinbutton', { name: /age/i });
    await user.type(ageInput, '30');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: 'any',
        dateOfBirth: 0,
        monthOfBirth: 0,
        yearOfBirth: 0,
        postcode: '',
        attributes: {
          '8b56eac7-5c76-4b9c-8c6f-1deab8d3fc47': '',
          '4697d0e6-5b24-416b-aee6-708cd9a3a1db': '',
          'a180fa5f-c44e-4490-a981-d7196b70c6ac': '',
        },
        age: 30,
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
      await user.click(screen.getByRole('button', { name: /apply/i }));

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
      await user.click(screen.getByRole('button', { name: /apply/i }));

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
