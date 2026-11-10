import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useFormProviderContext } from '../../../provider/form-provider';
import type { FormFieldInputProps } from '../../../types';
import TextArea from './text-area.component';

vi.mock('../../../provider/form-provider', () => ({ useFormProviderContext: vi.fn() }));

test('shows the configured character limit while entering a clinical narrative', async () => {
  vi.mocked(useFormProviderContext).mockReturnValue({
    layoutType: 'desktop',
    sessionMode: 'enter',
    workspaceLayout: 'maximized',
  } as never);
  const props = {
    field: {
      id: 'synthetic-narrative',
      label: 'Clinical narrative',
      questionOptions: { rendering: 'textarea', maxLength: '5', rows: 2 },
    },
    errors: [],
    warnings: [],
  } as unknown as FormFieldInputProps<string>;

  function ControlledNarrative() {
    const [value, setValue] = useState('');
    return (
      <TextArea
        {...props}
        value={value}
        setFieldValue={(nextValue) => setValue(String(nextValue))}
        errors={value.length > 5 ? [{ errCode: 'length', resultType: 'error', message: 'Too long' }] : []}
      />
    );
  }

  render(<ControlledNarrative />);
  const narrative = screen.getByRole('textbox', { name: 'Clinical narrative' });
  expect(screen.getByText('0/5')).toBeInTheDocument();

  await userEvent.type(narrative, '123456');
  expect(narrative).toHaveValue('123456');
  expect(screen.getByText('6/5')).toBeInTheDocument();
  expect(screen.getByText('Too long')).toBeInTheDocument();
  expect(narrative).not.toHaveAttribute('maxlength');
  const pasted = 'áe\u0301😀\n'.repeat(200);
  fireEvent.change(narrative, { target: { value: pasted } });
  expect(narrative).toHaveValue(pasted);
  expect(screen.getByText(`${pasted.length}/5`)).toBeInTheDocument();
});
