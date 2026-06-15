import { fireEvent, render, screen } from '@testing-library/react';
import type { FormField } from '../../../types';
import NumberField from './number.component';

const mockFormProviderContext = vi.hoisted(() => ({
  layoutType: 'desktop',
  sessionMode: 'enter',
  workspaceLayout: 'maximized',
}));

vi.mock('../../../provider/form-provider', () => ({
  useFormProviderContext: () => mockFormProviderContext,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (value: string) => value,
  }),
}));

describe('NumberField', () => {
  it('blocks invalid keys and paste values for non-negative integer fields', () => {
    renderNumberField({
      field: createNumberField({
        disallowDecimals: true,
        max: '20',
        min: '0',
      }),
    });

    const input = screen.getByRole('spinbutton', { name: /clinical value/i });

    for (const key of ['+', '-', ',', '@', 'e', 'E', '.']) {
      expect(fireEvent.keyDown(input, { key })).toBe(false);
    }

    expect(fireEvent.keyDown(input, { key: '5' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'v', metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'v', ctrlKey: true })).toBe(true);

    for (const value of ['+1', '-1', '1,2', '12@', '1e2', '1.0', '21']) {
      expect(fireEvent.paste(input, { clipboardData: { getData: () => value } })).toBe(false);
    }

    expect(fireEvent.paste(input, { clipboardData: { getData: () => '12' } })).toBe(true);
  });

  it('keeps negative decimal values available when the schema range allows them', () => {
    renderNumberField({
      field: createNumberField({
        max: '10',
        min: '-10',
      }),
    });

    const input = screen.getByRole('spinbutton', { name: /clinical value/i });

    expect(fireEvent.keyDown(input, { key: '-' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: '.' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'e' })).toBe(false);

    expect(fireEvent.paste(input, { clipboardData: { getData: () => '-1.5' } })).toBe(true);
    expect(fireEvent.paste(input, { clipboardData: { getData: () => '11' } })).toBe(false);
    expect(fireEvent.paste(input, { clipboardData: { getData: () => '1e2' } })).toBe(false);
  });
});

function renderNumberField(overrides: Partial<React.ComponentProps<typeof NumberField>> = {}) {
  render(
    <NumberField
      field={createNumberField()}
      value=""
      errors={[]}
      warnings={[]}
      setFieldValue={vi.fn()}
      {...overrides}
    />,
  );
}

function createNumberField(questionOptions: Partial<FormField['questionOptions']> = {}): FormField {
  return {
    id: 'clinical-value',
    label: 'Clinical value',
    questionOptions: {
      rendering: 'number',
      ...questionOptions,
    },
    type: 'obs',
  } as FormField;
}
