import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFormProviderContext } from '../../../provider/form-provider';
import type { FormField } from '../../../types';
import MultiSelect from './multi-select.component';

vi.mock('../../../provider/form-provider', () => ({ useFormProviderContext: vi.fn() }));

const field: FormField = {
  id: 'permeability',
  type: 'obs',
  label: 'Permeability',
  questionOptions: {
    rendering: 'checkbox',
    concept: 'synthetic-permeability',
    answers: [
      { concept: 'synthetic-esophagus', label: 'Esophagus' },
      { concept: 'synthetic-anus', label: 'Anus' },
    ],
  },
};

beforeEach(() => {
  vi.mocked(useFormProviderContext).mockReturnValue({
    sessionMode: 'edit',
    layoutType: 'desktop',
    formFieldAdapters: {},
  } as never);
});

it('shows persisted checkbox selections and preserves the other selected answer when removing one', async () => {
  const setFieldValue = vi.fn();
  render(
    <MultiSelect
      field={field}
      value={['synthetic-esophagus', 'synthetic-anus']}
      errors={[]}
      warnings={[]}
      setFieldValue={setFieldValue}
    />,
  );
  expect(screen.getByRole('checkbox', { name: 'Esophagus' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Anus' })).toBeChecked();
  expect(setFieldValue).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByText('Esophagus'));
  expect(setFieldValue).toHaveBeenCalledWith(['synthetic-anus']);
});

it('reflects observations that arrive after mount and subsequent form resets without emitting a change', () => {
  const setFieldValue = vi.fn();
  const props = { field, errors: [], warnings: [], setFieldValue };
  const { rerender } = render(<MultiSelect {...props} value={[]} />);
  rerender(<MultiSelect {...props} value={['synthetic-esophagus']} />);
  expect(screen.getByRole('checkbox', { name: 'Esophagus' })).toBeChecked();
  rerender(<MultiSelect {...props} value={['synthetic-anus']} />);
  expect(screen.getByRole('checkbox', { name: 'Esophagus' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Anus' })).toBeChecked();
  expect(setFieldValue).not.toHaveBeenCalled();
});

it('hydrates searchable selections when observations arrive after mount', async () => {
  const setFieldValue = vi.fn();
  const props = {
    field: { ...field, questionOptions: { ...field.questionOptions, isCheckboxSearchable: true } },
    errors: [],
    warnings: [],
    setFieldValue,
  };
  const { rerender } = render(<MultiSelect {...props} value={[]} />);
  rerender(<MultiSelect {...props} value={['synthetic-esophagus']} />);
  await userEvent.setup().click(screen.getByRole('combobox'));
  expect(screen.getByRole('option', { name: 'Esophagus' })).toHaveAttribute('aria-selected', 'true');
  expect(setFieldValue).not.toHaveBeenCalled();
});

it('keeps a persisted readonly selection and does not submit changes', async () => {
  const setFieldValue = vi.fn();
  render(
    <MultiSelect
      field={{ ...field, readonly: true }}
      value={['synthetic-esophagus']}
      errors={[]}
      warnings={[]}
      setFieldValue={setFieldValue}
    />,
  );
  expect(screen.getByRole('checkbox', { name: 'Esophagus' })).toBeChecked();
  await userEvent.setup().click(screen.getByText('Esophagus'));
  expect(setFieldValue).not.toHaveBeenCalled();
});
