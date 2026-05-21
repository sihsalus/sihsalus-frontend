import type { FormField } from '@sihsalus/esm-form-engine-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormFieldProvider } from '../../../../form-field-context';
import DateInput from './date.component';

const mockSetFormField = vi.fn();
const formField: FormField = {
  datePickerFormat: 'both',
  type: 'obs',
  questionOptions: { rendering: 'date' },
  id: '1',
};
vi.mock('../../../../form-field-context', async () => ({
  ...(await vi.importActual('../../../../form-field-context')),
  useFormField: () => ({ formField, setFormField: mockSetFormField }),
}));

describe('Date Component', () => {
  it('renders', () => {
    renderDateComponent();

    expect(screen.getByText(/the type of date picker to show/i)).toBeInTheDocument();
  });

  it('checks the default radio button based on date picker format', () => {
    renderDateComponent();

    const calendarAndTimerRadioButton = screen.getByRole('radio', {
      name: /calendar and timer/i,
    });

    expect(calendarAndTimerRadioButton).toBeChecked();
  });

  it('updates the form field when the date picker type is edited', async () => {
    renderDateComponent();

    const user = userEvent.setup();
    const calendarRadioButton = screen.getByRole('radio', { name: /calendar only/i });
    await user.click(calendarRadioButton);

    // Gets all calls made to our mock function, the arguments from the first call and the first argument of the first call
    const updateFn = mockSetFormField.mock.calls[0][0];

    // Execute the update function with the previous state
    const resultState = updateFn(formField);

    // Check that the result has the expected values
    expect(resultState).toEqual({
      ...formField,
      datePickerFormat: 'calendar',
    });
  });
});

function renderDateComponent() {
  render(
    <FormFieldProvider initialFormField={formField}>
      <DateInput />
    </FormFieldProvider>,
  );
}

import React from 'react';

void React;
