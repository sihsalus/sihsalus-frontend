import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { renderWithSwr } from 'test-utils';

import { type AdvancedPatientSearchState, type SearchFieldConfig } from '../../types';

import { usePersonAttributeType } from './person-attributes.resource';
import { getIntegerInputValue, isValidIntegerInput, SearchField } from './search-field.component';

vi.mock('./person-attributes.resource', async () => ({
  usePersonAttributeType: vi.fn(),
}));

const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);

vi.mock('react-hook-form', async () => ({
  ...(await vi.importActual('react-hook-form')),
  useForm: vi.fn().mockReturnValue({
    control: {
      register: vi.fn(),
      unregister: vi.fn(),
      getFieldState: vi.fn(),
      _names: {
        array: new Set(['test']),
        mount: new Set(['test']),
        unMount: new Set(['test']),
        watch: new Set(['test']),
        focus: 'test',
        watchAll: false,
      },
      _subjects: {
        watch: vi.fn(),
        array: vi.fn(),
        state: vi.fn(),
      },
      _getWatch: vi.fn(),
      _formValues: {},
      _defaultValues: {},
    },
    getValues: vi.fn(),
    setValue: vi.fn(),
    formState: { errors: {} },
  }),
  Controller: ({ render, name, control: _control }) =>
    render({
      field: {
        onChange: vi.fn(),
        onBlur: vi.fn(),
        value: '',
        name,
        ref: vi.fn(),
      },
      formState: { errors: {} },
      fieldState: { error: undefined },
    }),
}));

describe('SearchField', () => {
  const defaultProps = {
    control: useForm<AdvancedPatientSearchState>().control,
    inTabletOrOverlay: false,
    isTablet: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Integer input guards', () => {
    it('rejects scientific notation and decimal values', () => {
      expect(isValidIntegerInput('232.3e1231', 130, 3)).toBe(false);
      expect(isValidIntegerInput('1e2', 130, 3)).toBe(false);
      expect(isValidIntegerInput('12.5', 130, 3)).toBe(false);
      expect(isValidIntegerInput('+12', 130, 3)).toBe(false);
      expect(isValidIntegerInput('-12', 130, 3)).toBe(false);
      expect(isValidIntegerInput('12,5', 130, 3)).toBe(false);
      expect(isValidIntegerInput('0', 31, 2, 1)).toBe(false);
    });

    it('keeps the current value when the next value is invalid', () => {
      expect(getIntegerInputValue(23, '232', 130, 3)).toBe(23);
      expect(getIntegerInputValue(23, '2e3', 130, 3)).toBe(23);
      expect(getIntegerInputValue(23, '+2', 130, 3)).toBe(23);
      expect(getIntegerInputValue(23, '-2', 130, 3)).toBe(23);
      expect(getIntegerInputValue(23, '', 130, 3)).toBe(0);
    });

    it('prevents invalid age keystrokes and paste payloads in the rendered input', () => {
      render(
        <SearchField
          field={{
            name: 'age',
            type: 'age',
            min: 0,
            max: 120,
          }}
          {...defaultProps}
        />,
      );

      const ageInput = screen.getByRole('spinbutton', { name: /age/i });
      for (const key of ['e', 'E', '+', '-', '.', ',']) {
        expect(fireEvent.keyDown(ageInput, { key })).toBe(false);
      }
      expect(
        fireEvent.paste(ageInput, {
          clipboardData: { getData: () => '1e2' },
        }),
      ).toBe(false);
    });
  });

  describe('Gender field', () => {
    const genderField: SearchFieldConfig = {
      name: 'gender',
      type: 'gender',
    };

    it('renders all gender options', () => {
      render(<SearchField field={genderField} {...defaultProps} />);

      expect(screen.getByText('Any')).toBeInTheDocument();
      expect(screen.getByText('Male')).toBeInTheDocument();
      expect(screen.getByText('Female')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('groups gender options into two content switchers', () => {
      render(<SearchField field={genderField} {...defaultProps} />);
      const switchers = screen.getAllByRole('tablist');
      expect(switchers).toHaveLength(2);
    });
  });

  describe('Date of Birth field', () => {
    const dobField: SearchFieldConfig = {
      name: 'dateOfBirth',
      type: 'dateOfBirth',
    };

    it('renders three number inputs for day, month, and year', () => {
      render(<SearchField field={dobField} {...defaultProps} />);

      expect(screen.getByLabelText('Day of Birth')).toBeInTheDocument();
      expect(screen.getByLabelText('Month of Birth')).toBeInTheDocument();
      expect(screen.getByLabelText('Year of Birth')).toBeInTheDocument();
    });

    it('applies correct validation constraints to date inputs', () => {
      render(<SearchField field={dobField} {...defaultProps} />);

      const dayInput = screen.getByLabelText('Day of Birth');
      const monthInput = screen.getByLabelText('Month of Birth');
      const yearInput = screen.getByLabelText('Year of Birth');

      expect(dayInput).toHaveAttribute('min', '1');
      expect(dayInput).toHaveAttribute('max', '31');
      expect(monthInput).toHaveAttribute('min', '1');
      expect(monthInput).toHaveAttribute('max', '12');
      expect(yearInput).toHaveAttribute('min', '1800');
      expect(yearInput).toHaveAttribute('max', new Date().getFullYear().toString());
    });
  });

  describe('Age field', () => {
    const ageField: SearchFieldConfig = {
      name: 'age',
      type: 'age',
      min: 0,
      max: 120,
    };

    it('renders number input with correct constraints', () => {
      render(<SearchField field={ageField} {...defaultProps} />);

      const ageInput = screen.getByLabelText('Age');
      expect(ageInput).toBeInTheDocument();
      expect(ageInput).toHaveAttribute('type', 'number');
      expect(ageInput).toHaveAttribute('min', '0');
      expect(ageInput).toHaveAttribute('max', '120');
    });
  });

  describe('Postcode field', () => {
    const postcodeField: SearchFieldConfig = {
      name: 'postcode',
      type: 'postcode',
      placeholder: 'Enter postcode',
    };

    it('renders text input with correct attributes', () => {
      render(<SearchField field={postcodeField} {...defaultProps} />);
      const input = screen.getByLabelText('Postcode');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
    });
  });

  describe('Person Attribute field', () => {
    const personAttributeField: SearchFieldConfig = {
      name: 'test-uuid',
      type: 'personAttribute',
      attributeTypeUuid: 'test-uuid',
    };

    beforeEach(() => {
      mockUsePersonAttributeType.mockReturnValue({
        data: {
          format: 'java.lang.String',
          display: 'Nombre del Acompañante',
          uuid: 'test-uuid',
        },
        isLoading: false,
        error: null,
      });
    });

    it('renders person attribute field with correct props', () => {
      renderWithSwr(<SearchField field={personAttributeField} {...defaultProps} />);
      expect(screen.getByText('Nombre del Acompañante')).toBeInTheDocument();
    });

    it('renders configured string answer options for boolean-like person attributes', () => {
      mockUsePersonAttributeType.mockReturnValue({
        data: {
          format: 'java.lang.String',
          display: 'Paciente No Identificado',
          uuid: 'unknown-patient-uuid',
        },
        isLoading: false,
        error: null,
      });

      renderWithSwr(
        <SearchField
          field={{
            name: 'unknown-patient-uuid',
            type: 'personAttribute',
            attributeTypeUuid: 'unknown-patient-uuid',
            stringAnswerOptions: [
              { label: 'Sí', value: 'true' },
              { label: 'No', value: 'false' },
            ],
          }}
          {...defaultProps}
        />,
      );

      expect(screen.getByText('Paciente No Identificado')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Responsive behavior', () => {
    const ageField: SearchFieldConfig = {
      name: 'age',
      type: 'age',
    };

    it('applies tablet styles when in tablet mode', () => {
      const { unmount } = render(<SearchField field={ageField} {...defaultProps} />);
      const defaultInput = screen.getByLabelText('Age');
      const defaultNumberInput = defaultInput.closest('.cds--number');
      const defaultClassName = defaultNumberInput?.getAttribute('class') ?? '';
      unmount();

      render(<SearchField field={ageField} {...defaultProps} isTablet={true} />);
      const tabletInput = screen.getByLabelText('Age');
      const tabletNumberInput = tabletInput.closest('.cds--number');
      const tabletClassName = tabletNumberInput?.getAttribute('class') ?? '';

      expect(tabletInput).toBeInTheDocument();
      expect(tabletClassName).not.toEqual(defaultClassName);
    });

    it('applies overlay styles when in overlay mode', () => {
      const { container: defaultContainer, unmount } = render(<SearchField field={ageField} {...defaultProps} />);
      const defaultRoot = defaultContainer.firstElementChild;
      const defaultClassName = defaultRoot?.getAttribute('class') ?? '';
      unmount();

      const { container: overlayContainer } = render(
        <SearchField field={ageField} {...defaultProps} inTabletOrOverlay={true} />,
      );
      const overlayInput = screen.getByLabelText('Age');
      const overlayRoot = overlayContainer.firstElementChild;
      const overlayClassName = overlayRoot?.getAttribute('class') ?? '';

      expect(overlayInput).toBeInTheDocument();
      expect(overlayClassName).not.toEqual(defaultClassName);
    });
  });
});
