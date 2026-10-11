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

it('displays a checkbox validation error and describes each focusable answer with the group message', () => {
  const message = 'Do not select None together with other answers.';
  const setFieldValue = vi.fn();
  const { rerender } = render(
    <MultiSelect
      field={field}
      value={['synthetic-esophagus', 'synthetic-anus']}
      errors={[{ resultType: 'error', errCode: 'value.invalid', message }]}
      warnings={[{ resultType: 'warning', message: 'Review the selection.' }]}
      setFieldValue={setFieldValue}
    />,
  );
  const group = screen.getByRole('group', { name: 'Permeability' });
  expect(screen.getByText(message)).toBeVisible();
  expect(screen.queryByText('Review the selection.')).not.toBeInTheDocument();
  expect(group).toHaveAttribute('data-invalid', 'true');
  expect(group).toHaveAccessibleDescription(message);
  for (const checkbox of screen.getAllByRole('checkbox')) {
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(checkbox).toHaveAccessibleDescription(message);
    expect(checkbox).toBeChecked();
  }
  expect(setFieldValue).not.toHaveBeenCalled();

  rerender(
    <MultiSelect
      field={field}
      value={['synthetic-esophagus']}
      errors={[]}
      warnings={[]}
      setFieldValue={setFieldValue}
    />,
  );
  expect(screen.queryByText(message)).not.toBeInTheDocument();
  expect(group).not.toHaveAttribute('aria-describedby');
  expect(group).not.toHaveAttribute('data-invalid');
  for (const checkbox of screen.getAllByRole('checkbox')) {
    expect(checkbox).not.toHaveAttribute('aria-describedby');
    expect(checkbox).not.toHaveAttribute('aria-invalid');
  }
});

it('displays a warning without marking answers invalid and keeps messages scoped to each group', () => {
  render(
    <>
      <MultiSelect
        field={field}
        value={['synthetic-esophagus']}
        errors={[]}
        warnings={[{ resultType: 'warning', message: 'Review the first selection.' }]}
        setFieldValue={vi.fn()}
      />
      <MultiSelect
        field={{ ...field, id: 'second-field', label: 'Second group' }}
        value={[]}
        errors={[]}
        warnings={[{ resultType: 'warning', message: 'Review the second selection.' }]}
        setFieldValue={vi.fn()}
      />
    </>,
  );
  expect(screen.getByText('Review the first selection.')).toBeVisible();
  expect(screen.getByRole('group', { name: 'Permeability' })).toHaveAccessibleDescription(
    'Review the first selection.',
  );
  expect(screen.getByRole('group', { name: 'Second group' })).toHaveAccessibleDescription(
    'Review the second selection.',
  );
  const checkboxes = screen.getAllByRole('checkbox');
  for (const [index, checkbox] of checkboxes.entries()) {
    expect(checkbox).not.toHaveAttribute('aria-invalid');
    expect(checkbox).toHaveAccessibleDescription(
      index < 2 ? 'Review the first selection.' : 'Review the second selection.',
    );
  }
});

it('keeps readonly checkbox groups free of hidden validation references', () => {
  render(
    <MultiSelect
      field={{ ...field, readonly: true }}
      value={['synthetic-esophagus']}
      errors={[{ resultType: 'error', message: 'Invalid selection.' }]}
      warnings={[]}
      setFieldValue={vi.fn()}
    />,
  );
  expect(screen.queryByText('Invalid selection.')).not.toBeInTheDocument();
  expect(screen.getByRole('group')).not.toHaveAttribute('aria-describedby');
  for (const checkbox of screen.getAllByRole('checkbox')) {
    expect(checkbox).not.toHaveAttribute('aria-describedby');
    expect(checkbox).not.toHaveAttribute('aria-invalid');
  }
});
