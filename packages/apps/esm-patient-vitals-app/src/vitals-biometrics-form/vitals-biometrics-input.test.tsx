import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import { mockConceptUnits } from 'test-utils';

import { assessValue, getReferenceRangesForConcept } from '../common';
import { type ConfigObject, configSchema } from '../config-schema';

import VitalsAndBiometricsInput from './vitals-biometrics-input.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

const overridenMetadata = [
  {
    uuid: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    display: 'Systolic blood pressure',
    hiNormal: 140,
    hiAbsolute: 250,
    hiCritical: 180,
    lowNormal: 100,
    lowAbsolute: 0,
    lowCritical: 85,
    units: 'mmHg',
  },
  {
    uuid: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    display: 'Pulse',
    hiNormal: 100,
    hiAbsolute: 230,
    hiCritical: 130,
    lowNormal: 55,
    lowAbsolute: 0,
    lowCritical: 49,
    units: 'beats/min',
  },
];

vi.mock('react-hook-form', async () => ({
  ...(await vi.importActual('react-hook-form')),
  useFormContext: vi.fn().mockImplementation(() => ({
    handleSubmit: () => vi.fn(),
    control: {
      register: vi.fn(),
      unregister: vi.fn(),
      getFieldState: vi.fn(),
      _names: {
        array: new Set('test'),
        mount: new Set('test'),
        unMount: new Set('test'),
        watch: new Set('test'),
        focus: 'test',
        watchAll: false,
      },
      _subjects: {
        watch: vi.fn(),
        array: vi.fn(),
        state: vi.fn(),
      },
      _getWatch: vi.fn(),
      _formValues: [],
      _defaultValues: [],
    },
    getValues: () => {
      return [];
    },
    setValue: () => vi.fn(),
    formState: () => vi.fn(),
    watch: () => vi.fn(),
  })),
  Controller: ({ render }) =>
    render({
      field: {
        onChange: vi.fn(),
        onBlur: vi.fn(),
        value: '',
        ref: vi.fn(),
      },
      formState: {
        isSubmitted: false,
      },
      fieldState: {
        isTouched: false,
      },
    }),
  useSubscribe: () => ({
    r: { current: { subject: { subscribe: () => vi.fn() } } },
  }),
}));

vi.mock('../common', async () => {
  const originalModule = await vi.importActual('../common');

  return {
    ...originalModule,
    launchPatientWorkspace: vi.fn(),
    useVitalsConceptMetadata: vi.fn().mockImplementation(() => ({
      data: mockConceptUnits,
      conceptMetadata: { ...overridenMetadata },
      isLoading: false,
    })),
    useVitalsAndBiometrics: vi.fn(),
  };
});

const defaultProps = {
  control: undefined,
  isWithinNormalRange: true,
  fieldProperties: [],
  interpretation: undefined,
  placeholder: '',
  label: '',
  unitSymbol: '',
};

mockUseConfig.mockReturnValue({
  ...(getDefaultsFromConfigSchema(configSchema) as Record<string, unknown>),
  concepts: {
    pulseUuid: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
} as unknown as ConfigObject);

describe('VitalsAndBiometricsInput', () => {
  it('renders number inputs based correctly on the props provided', () => {
    renderVitalsBiometricsInput({
      fieldProperties: [
        {
          id: 'pulse',
          name: 'Heart rate',
          type: 'number',
        },
      ],
      label: 'Heart rate',
      unitSymbol: 'bpm',
    });

    const heartRateInput = screen.getByRole('spinbutton', {
      name: /heart rate/i,
    });
    expect(heartRateInput).toBeInTheDocument();
    expect(screen.getByPlaceholderText('--')).toBeInTheDocument();
    expect(screen.getByTitle(/heart rate/i)).toBeInTheDocument();
    expect(screen.getByText(/bpm/i)).toBeInTheDocument();
  });

  it('blocks invalid clinical numeric keys and preserves keyboard shortcuts', () => {
    renderVitalsBiometricsInput({
      fieldProperties: [
        {
          id: 'pulse',
          integer: true,
          name: 'Heart rate',
          type: 'number',
        },
      ],
      label: 'Heart rate',
      unitSymbol: 'bpm',
    });

    const heartRateInput = screen.getByRole('spinbutton', {
      name: /heart rate/i,
    });

    for (const key of ['+', '-', ',', '@', 'e', 'E', '.']) {
      expect(fireEvent.keyDown(heartRateInput, { key })).toBe(false);
    }

    expect(fireEvent.keyDown(heartRateInput, { key: '5' })).toBe(true);
    expect(fireEvent.keyDown(heartRateInput, { key: 'v', metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(heartRateInput, { key: 'v', ctrlKey: true })).toBe(true);
  });

  it('blocks pasting invalid clinical numeric values', () => {
    renderVitalsBiometricsInput({
      fieldProperties: [
        {
          id: 'pulse',
          integer: true,
          max: 250,
          min: 0,
          name: 'Heart rate',
          type: 'number',
        },
      ],
      label: 'Heart rate',
      unitSymbol: 'bpm',
    });

    const heartRateInput = screen.getByRole('spinbutton', {
      name: /heart rate/i,
    });

    for (const value of ['+1', '-1', '1,2', '12@', '1e100', '120.0', '251']) {
      expect(fireEvent.paste(heartRateInput, { clipboardData: { getData: () => value } })).toBe(false);
    }

    expect(fireEvent.paste(heartRateInput, { clipboardData: { getData: () => '120' } })).toBe(true);
  });

  it('keeps decimal-capable clinical fields usable while blocking invalid values', () => {
    renderVitalsBiometricsInput({
      fieldProperties: [
        {
          id: 'temperature',
          max: 45,
          min: 30,
          name: 'Temperature',
          type: 'number',
        },
      ],
      label: 'Temperature',
      unitSymbol: 'C',
    });

    const temperatureInput = screen.getByRole('spinbutton', {
      name: /temperature/i,
    });

    expect(fireEvent.keyDown(temperatureInput, { key: '.' })).toBe(true);
    expect(fireEvent.keyDown(temperatureInput, { key: '-' })).toBe(false);
    expect(fireEvent.keyDown(temperatureInput, { key: 'e' })).toBe(false);

    expect(fireEvent.paste(temperatureInput, { clipboardData: { getData: () => '36.5' } })).toBe(true);
    expect(fireEvent.paste(temperatureInput, { clipboardData: { getData: () => '46' } })).toBe(false);
    expect(fireEvent.paste(temperatureInput, { clipboardData: { getData: () => '1e2' } })).toBe(false);
  });

  it('renders textarea inputs correctly based on the props provided', () => {
    renderVitalsBiometricsInput({
      fieldProperties: [
        {
          id: 'generalPatientNote',
          name: 'Notes',
          type: 'textarea',
        },
      ],
      placeholder: 'Type any additional notes here',
      label: 'Notes',
    });

    const noteInput = screen.getByRole('textbox', { name: /notes/i });
    expect(noteInput).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type any additional notes here/i)).toBeInTheDocument();
    expect(screen.getByTitle(/notes/i)).toBeInTheDocument();
  });

  it('renders select inputs correctly based on the props provided', () => {
    renderVitalsBiometricsInput({
      fieldProperties: [
        {
          id: 'glasgowEyeOpening',
          name: 'Eye opening',
          type: 'select',
          options: [
            { value: 4, label: '4 - Spontaneous' },
            { value: 1, label: '1 - None' },
          ],
        },
      ],
      label: 'Eye opening',
    });

    expect(screen.getByRole('combobox', { name: /eye opening/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /select an option/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /4 - spontaneous/i })).toBeInTheDocument();
    expect(screen.getByTitle(/eye opening/i)).toBeInTheDocument();
  });

  it('should validate the input based on the provided interpretation and reference range values', async () => {
    const config = useConfig();

    renderVitalsBiometricsInput({
      fieldProperties: [
        {
          id: 'pulse',
          name: 'Heart rate',
          min: 0,
          max: 230,
          type: 'number',
        },
      ],
      interpretation: assessValue(300, getReferenceRangesForConcept(config.concepts.pulseUuid, overridenMetadata)),
      label: 'Heart rate',
      unitSymbol: 'bpm',
    });

    await screen.findByRole('spinbutton');

    expect(screen.getByRole('spinbutton', { name: /heart rate/i })).toBeInTheDocument();
    const abnormalValueFlag = screen.getByTitle(/abnormal value/i);
    expect(abnormalValueFlag).toBeInTheDocument();
    expect(abnormalValueFlag).toHaveAccessibleName(/abnormal value/i);
  });
});

function renderVitalsBiometricsInput(props = {}) {
  render(<VitalsAndBiometricsInput {...defaultProps} {...props} />);
}
