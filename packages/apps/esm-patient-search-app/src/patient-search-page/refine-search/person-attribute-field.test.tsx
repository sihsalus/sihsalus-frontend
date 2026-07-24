import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

import {
  type AdvancedPatientSearchState,
  type LocationEntry,
  type PersonAttributeTypeResponse,
  type SearchFieldConfig,
} from '../../types';

import {
  PersonAttributeField,
  type PersonAttributeFieldProps,
  sanitizePersonAttributeText,
} from './person-attribute-field.component';
import {
  useAttributeConceptAnswers,
  useConfiguredAnswerConcepts,
  useLocations,
  usePersonAttributeType,
} from './person-attributes.resource';

vi.mock('react-hook-form', async () => ({
  ...(await vi.importActual('react-hook-form')),
  useForm: vi.fn().mockReturnValue({
    handleSubmit: vi.fn(),
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
    getValues: vi.fn((str) => (str === 'recurringPatternDaysOfWeek' ? [] : null)),
    setValue: vi.fn(),
    formState: { errors: {} },
    watch: vi.fn(),
  }),
  Controller: ({ render }) =>
    render({
      field: {
        onChange: vi.fn(),
        onBlur: vi.fn(),
        value: '',
        name: 'test',
        ref: vi.fn(),
      },
      formState: {
        isSubmitted: false,
        errors: {},
      },
      fieldState: {
        isTouched: false,
        error: undefined,
      },
    }),
}));

vi.mock('./person-attributes.resource', async () => ({
  usePersonAttributeType: vi.fn(),
  useAttributeConceptAnswers: vi.fn(),
  useConfiguredAnswerConcepts: vi.fn(),
  useLocations: vi.fn(),
}));

const mockUsePersonAttributeType = vi.mocked(usePersonAttributeType);
const mockUseAttributeConceptAnswers = vi.mocked(useAttributeConceptAnswers);
const mockUseConfiguredAnswerConcepts = vi.mocked(useConfiguredAnswerConcepts);
const mockUseLocations = vi.mocked(useLocations);

describe('PersonAttributeField', () => {
  const user = userEvent.setup();

  const defaultProps: PersonAttributeFieldProps = {
    field: {
      name: 'testAttribute',
      type: 'personAttribute',
      label: 'Test Attribute',
      attributeTypeUuid: 'test-uuid',
    } as SearchFieldConfig,
    inTabletOrOverlay: false,
    isTablet: false,
    control: useForm<AdvancedPatientSearchState>().control,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('String input guards', () => {
    it('strips digits and unsupported symbols when numbers are disallowed', () => {
      expect(sanitizePersonAttributeText('Juan 123 @_ Perez', true)).toBe('Juan Perez');
      expect(sanitizePersonAttributeText('Tio-abuelo 2', true)).toBe('Tio-abuelo ');
    });

    it('preserves ordinary text when numeric stripping is not configured', () => {
      expect(sanitizePersonAttributeText('Codigo 123', false)).toBe('Codigo 123');
    });
  });

  describe('String Attribute Type', () => {
    beforeEach(() => {
      mockUsePersonAttributeType.mockReturnValue({
        data: { format: 'java.lang.String', display: 'Test String Attribute' } as PersonAttributeTypeResponse,
        isLoading: false,
        error: null,
      });
    });

    it('renders text input for string attribute type', () => {
      render(<PersonAttributeField {...defaultProps} />);
      expect(screen.getByLabelText('Test String Attribute')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Concept Attribute Type', () => {
    beforeEach(() => {
      mockUsePersonAttributeType.mockReturnValue({
        data: { format: 'org.openmrs.Concept', display: 'Test Concept Attribute' } as PersonAttributeTypeResponse,
        isLoading: false,
        error: null,
      });

      mockUseConfiguredAnswerConcepts.mockReturnValue({
        configuredConceptAnswers: [],
        isLoadingConfiguredAnswers: false,
      });

      mockUseAttributeConceptAnswers.mockReturnValue({
        conceptAnswers: [
          { uuid: 'concept-answer-uuid-1', display: 'concept-answer-1' },
          { uuid: 'concept-answer-uuid-2', display: 'concept-answer-2' },
        ],
        isLoadingConceptAnswers: false,
        errorFetchingConceptAnswers: null,
      });
    });

    it('renders a combobox for concept attribute type', async () => {
      render(<PersonAttributeField {...defaultProps} />);
      const combobox = screen.getByRole('combobox');

      expect(combobox).toBeInTheDocument();
      expect(screen.getByText('Test Concept Attribute')).toBeInTheDocument();
      await user.click(combobox);
      expect(screen.getByText('concept-answer-1')).toBeInTheDocument();
      expect(screen.getByText('concept-answer-2')).toBeInTheDocument();
    });

    it('sorts concept answers without mutating the resource data', async () => {
      const conceptAnswers = [
        { uuid: 'zulu-uuid', display: 'Zulu' },
        { uuid: 'alpha-uuid', display: 'Alpha' },
      ];
      mockUseAttributeConceptAnswers.mockReturnValue({
        conceptAnswers,
        isLoadingConceptAnswers: false,
        errorFetchingConceptAnswers: null,
      });

      render(<PersonAttributeField {...defaultProps} />);
      await user.click(screen.getByRole('combobox'));

      const alphaOption = screen.getByText('Alpha');
      const zuluOption = screen.getByText('Zulu');
      expect(alphaOption.compareDocumentPosition(zuluOption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(conceptAnswers.map(({ display }) => display)).toEqual(['Zulu', 'Alpha']);
    });

    it('ignores incomplete concept answers returned by the server', async () => {
      mockUseAttributeConceptAnswers.mockReturnValue({
        conceptAnswers: [
          null,
          { uuid: '', display: 'Missing UUID' },
          { uuid: 'missing-display-uuid' },
          { uuid: 'valid-uuid', display: 'Valid answer' },
        ] as unknown as Array<{ uuid: string; display: string }>,
        isLoadingConceptAnswers: false,
        errorFetchingConceptAnswers: null,
      });

      render(<PersonAttributeField {...defaultProps} />);
      await user.click(screen.getByRole('combobox'));

      expect(screen.getByText('Valid answer')).toBeInTheDocument();
      expect(screen.queryByText('Missing UUID')).not.toBeInTheDocument();
    });

    it('handles custom concept answers', async () => {
      mockUsePersonAttributeType.mockReturnValue({
        data: {
          format: 'org.openmrs.Concept',
          display: 'Test Concept Attribute',
        } as PersonAttributeTypeResponse,
        isLoading: false,
        error: null,
      });

      mockUseConfiguredAnswerConcepts.mockReturnValue({
        configuredConceptAnswers: [
          { uuid: 'concept-answer-1-uuid', display: 'concept-answer-1' },
          { uuid: 'concept-answer-2-uuid', display: 'concept-answer-2' },
        ],
        isLoadingConfiguredAnswers: false,
      });

      const propsWithCustomConcepts: PersonAttributeFieldProps = {
        ...defaultProps,
        field: {
          ...defaultProps.field,
          answerConceptSetUuid: 'test-concept-set-uuid',
          conceptAnswersUuids: ['concept-answer-1-uuid', 'concept-answer-2-uuid'],
        },
      };

      render(<PersonAttributeField {...propsWithCustomConcepts} />);
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);
      expect(screen.getByText('concept-answer-1')).toBeInTheDocument();
      expect(screen.getByText('concept-answer-2')).toBeInTheDocument();
    });

    it('handles concept selection', async () => {
      mockUsePersonAttributeType.mockReturnValue({
        data: {
          format: 'org.openmrs.Concept',
          display: 'Test Concept Attribute',
        } as PersonAttributeTypeResponse,
        isLoading: false,
        error: null,
      });
      mockUseConfiguredAnswerConcepts.mockReturnValue({
        configuredConceptAnswers: [
          { uuid: 'concept-answer-1-uuid', display: 'concept-answer-1' },
          { uuid: 'concept-answer-2-uuid', display: 'concept-answer-2' },
        ],
        isLoadingConfiguredAnswers: false,
      });
      const propsWithAnswerConceptUuidAndCustomAnswers: PersonAttributeFieldProps = {
        ...defaultProps,
        field: {
          ...defaultProps.field,
          answerConceptSetUuid: 'test-concept-set-uuid',
          conceptAnswersUuids: ['concept-answer-1-uuid', 'concept-answer-2-uuid'],
        },
      };

      render(<PersonAttributeField {...propsWithAnswerConceptUuidAndCustomAnswers} />);

      const combobox = screen.getByRole('combobox');
      await user.click(combobox);
      expect(screen.getByText('concept-answer-1')).toBeInTheDocument();
      expect(screen.getByText('concept-answer-2')).toBeInTheDocument();
    });

    it('hides the optional concept filter when the user lacks permission to load its answers', () => {
      mockUseAttributeConceptAnswers.mockReturnValue({
        conceptAnswers: [],
        isLoadingConceptAnswers: false,
        errorFetchingConceptAnswers: Object.assign(new Error('Forbidden'), { response: { status: 403 } }),
      });

      const { container } = render(<PersonAttributeField {...defaultProps} />);

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText('Error loading concept attribute answers')).not.toBeInTheDocument();
    });

    it('keeps the error notification for failures other than missing permissions', () => {
      mockUseAttributeConceptAnswers.mockReturnValue({
        conceptAnswers: [],
        isLoadingConceptAnswers: false,
        errorFetchingConceptAnswers: new Error('Server error'),
      });

      render(<PersonAttributeField {...defaultProps} />);

      expect(screen.getByText('Error loading concept attribute answers')).toBeInTheDocument();
    });
  });

  describe('Location Attribute Type', () => {
    beforeEach(() => {
      mockUsePersonAttributeType.mockReturnValue({
        data: { format: 'org.openmrs.Location', display: 'Test Location Attribute' } as PersonAttributeTypeResponse,
        isLoading: false,
        error: null,
      });
      mockUseLocations.mockReturnValue({
        locations: [
          { resource: { id: 'location-1-uuid', name: 'Location 1' } },
          { resource: { id: 'location-2-uuid', name: 'Location 2' } },
        ] as LocationEntry[],
        isLoading: false,
        loadingNewData: false,
        error: undefined,
      });
    });

    it('renders location combobox', () => {
      render(<PersonAttributeField {...defaultProps} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Test Location Attribute')).toBeInTheDocument();
    });

    it('handles location search input', async () => {
      render(<PersonAttributeField {...defaultProps} />);
      const combobox = screen.getByRole('combobox');
      await user.type(combobox, 'Loc');
      expect(mockUseLocations).toHaveBeenCalledWith(null, 'Loc');
    });
  });

  describe('Error Handling', () => {
    it('hides missing optional attribute filters when the backend returns 404', () => {
      mockUsePersonAttributeType.mockReturnValue({
        data: null,
        isLoading: false,
        error: Object.assign(new Error('Not Found'), { response: { status: 404 } }),
      });

      const { container } = render(<PersonAttributeField {...defaultProps} />);

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText('Error loading attribute type test-uuid')).not.toBeInTheDocument();
    });

    it('hides optional attribute filters when loading the attribute type fails', () => {
      mockUsePersonAttributeType.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load attribute type'),
      });
      const { container } = render(<PersonAttributeField {...defaultProps} />);

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText('Error loading attribute type test-uuid')).not.toBeInTheDocument();
    });
  });

  describe('Unsupported Attribute Format', () => {
    it('shows an error for unsupported formats', () => {
      mockUsePersonAttributeType.mockReturnValue({
        data: { format: 'unsupported.format', display: 'Unsupported Attribute' } as PersonAttributeTypeResponse,
        isLoading: false,
        error: null,
      });
      render(<PersonAttributeField {...defaultProps} />);
      expect(screen.getByText('Unsupported attribute format: unsupported.format')).toBeInTheDocument();
    });
  });
});
