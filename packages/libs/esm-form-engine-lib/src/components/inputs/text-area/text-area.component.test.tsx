import { render, screen } from '@testing-library/react';
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
    return <TextArea {...props} value={value} setFieldValue={(nextValue) => setValue(String(nextValue))} />;
  }

  render(<ControlledNarrative />);
  const narrative = screen.getByRole('textbox', { name: 'Clinical narrative' });
  expect(screen.getByText('0/5')).toBeInTheDocument();

  await userEvent.type(narrative, '123456');
  expect(narrative).toHaveValue('12345');
  expect(screen.getByText('5/5')).toBeInTheDocument();
});
