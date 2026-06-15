import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import type { Control } from 'react-hook-form';
import GenericInput from './generic-input.component';

type TestFormData = Record<string, number | string | undefined>;

type GenericInputTestProps = {
  fieldProperties: Array<{
    id: string;
    integer?: boolean;
    max?: number | null;
    min?: number | null;
    name: string;
    nonNegative?: boolean;
    type?: 'number' | 'textarea';
  }>;
  label: string;
};

type ControllerRenderProps = {
  render: (props: {
    field: {
      onBlur: () => void;
      onChange: (value: number | undefined) => void;
      ref: () => void;
      value: string;
    };
    fieldState: Record<string, never>;
    formState: Record<string, never>;
  }) => React.ReactNode;
};

const mockControllerOnChange = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ResponsiveWrapper: ({ children }: { children: React.ReactNode }) => children,
  useLayoutType: vi.fn(() => 'desktop'),
}));

vi.mock('react-hook-form', async () => ({
  ...(await vi.importActual('react-hook-form')),
  Controller: ({ render }: ControllerRenderProps) =>
    render({
      field: {
        onBlur: vi.fn(),
        onChange: mockControllerOnChange,
        ref: vi.fn(),
        value: '',
      },
      fieldState: {},
      formState: {},
    }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('GenericInput', () => {
  beforeEach(() => {
    mockControllerOnChange.mockReset();
  });

  it('blocks invalid integer keys and preserves keyboard shortcuts', () => {
    renderGenericInput({
      fieldProperties: [
        {
          id: 'gravidez',
          integer: true,
          max: 20,
          min: 0,
          name: 'Gravidez',
        },
      ],
      label: 'Gravidez',
    });

    const gravidezInput = screen.getByRole('spinbutton', {
      name: /gravidez/i,
    });

    for (const key of ['+', '-', ',', '@', 'e', 'E', '.']) {
      expect(fireEvent.keyDown(gravidezInput, { key })).toBe(false);
    }

    expect(fireEvent.keyDown(gravidezInput, { key: '5' })).toBe(true);
    expect(fireEvent.keyDown(gravidezInput, { key: 'v', metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(gravidezInput, { key: 'v', ctrlKey: true })).toBe(true);
  });

  it('blocks invalid integer paste values before they reach the form state', () => {
    renderGenericInput({
      fieldProperties: [
        {
          id: 'gravidez',
          integer: true,
          max: 20,
          min: 0,
          name: 'Gravidez',
        },
      ],
      label: 'Gravidez',
    });

    const gravidezInput = screen.getByRole('spinbutton', {
      name: /gravidez/i,
    });

    for (const value of ['+1', '-1', '1,2', '12@', '1e2', '1.0', '21']) {
      expect(fireEvent.paste(gravidezInput, { clipboardData: { getData: () => value } })).toBe(false);
    }

    expect(fireEvent.paste(gravidezInput, { clipboardData: { getData: () => '12' } })).toBe(true);
  });

  it('keeps decimal fields usable while preserving range and format guards', () => {
    renderGenericInput({
      fieldProperties: [
        {
          id: 'temperature',
          max: 45,
          min: 30,
          name: 'Temperature',
        },
      ],
      label: 'Temperature',
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

  it('does not propagate invalid formatted values to react-hook-form', () => {
    renderGenericInput({
      fieldProperties: [
        {
          id: 'gravidez',
          integer: true,
          max: 20,
          min: 0,
          name: 'Gravidez',
        },
      ],
      label: 'Gravidez',
    });

    const gravidezInput = screen.getByRole('spinbutton', {
      name: /gravidez/i,
    });

    fireEvent.change(gravidezInput, { target: { value: '1e2' } });
    expect(mockControllerOnChange).not.toHaveBeenCalled();

    fireEvent.change(gravidezInput, { target: { value: '12' } });
    expect(mockControllerOnChange).toHaveBeenCalledWith(12);
  });
});

function renderGenericInput(props: GenericInputTestProps) {
  render(<GenericInput<TestFormData> control={undefined as unknown as Control<TestFormData>} {...props} />);
}
