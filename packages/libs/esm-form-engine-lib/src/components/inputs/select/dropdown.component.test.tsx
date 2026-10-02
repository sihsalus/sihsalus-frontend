import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFormProviderContext } from '../../../provider/form-provider';
import type { FormField } from '../../../types';
import Dropdown from './dropdown.component';

vi.mock('../../../provider/form-provider', () => ({ useFormProviderContext: vi.fn() }));

const field: FormField = {
  id: 'onset',
  type: 'obs',
  label: 'Forma de inicio',
  meta: {},
  questionOptions: {
    rendering: 'select',
    concept: 'synthetic-text-concept',
    answers: [
      { value: 'Gradual', label: 'Gradual' },
      { value: 'Súbito', label: 'Súbito' },
    ],
  },
};

beforeEach(() => {
  vi.mocked(useFormProviderContext).mockReturnValue({ sessionMode: 'enter', layoutType: 'desktop' } as never);
});

it('requires an explicit selection and sends the literal answer to the observation adapter', async () => {
  const setFieldValue = vi.fn();
  render(<Dropdown field={field} value="" errors={[]} warnings={[]} setFieldValue={setFieldValue} />);
  expect(setFieldValue).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: 'Gradual' }));
  expect(setFieldValue).toHaveBeenCalledWith('Gradual');
});

it('keeps a historical narrative visible and unchanged until the user chooses another value', async () => {
  const setFieldValue = vi.fn();
  render(
    <Dropdown
      field={field}
      value="Inicio descrito previamente"
      errors={[]}
      warnings={[]}
      setFieldValue={setFieldValue}
    />,
  );
  expect(screen.getByRole('combobox')).toHaveTextContent('Inicio descrito previamente');
  expect(setFieldValue).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox'));
  expect(screen.getByRole('option', { name: 'Inicio descrito previamente' })).toBeInTheDocument();
});

it('continues to display coded answer labels', () => {
  const codedField = {
    ...field,
    questionOptions: {
      ...field.questionOptions,
      answers: [{ concept: 'synthetic-coded-answer', label: 'Respuesta codificada' }],
    },
  };
  render(
    <Dropdown field={codedField} value="synthetic-coded-answer" errors={[]} warnings={[]} setFieldValue={vi.fn()} />,
  );
  expect(screen.getByRole('combobox')).toHaveTextContent('Respuesta codificada');
});
