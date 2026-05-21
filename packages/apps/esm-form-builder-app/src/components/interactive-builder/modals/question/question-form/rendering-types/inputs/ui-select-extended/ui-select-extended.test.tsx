import type { FormField } from '@sihsalus/esm-form-engine-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormFieldProvider } from '../../../../form-field-context';
import UiSelectExtended from './ui-select-extended.component';

const mockSetFormField = vi.fn();
const formField: FormField = {
  type: 'obs',
  questionOptions: { rendering: 'ui-select-extended', isSearchable: false },
  id: '1',
};

vi.mock('../../../../form-field-context', async () => ({
  ...(await vi.importActual('../../../../form-field-context')),
  useFormField: () => ({ formField, setFormField: mockSetFormField }),
}));

describe('UiSelectExtended Component', () => {
  it('renders', () => {
    renderUiSelectExtendedComponent();

    expect(screen.getByText(/is the ui-select-extended rendering searchable/i)).toBeInTheDocument();
  });

  it('shows the default isSearchable value', () => {
    renderUiSelectExtendedComponent();

    const notSearchableRadioButton = screen.getByRole('radio', { name: /not searchable/i });

    expect(notSearchableRadioButton).toBeChecked();
  });

  it('updates the form field when the isSearchable value is edited', async () => {
    formField.questionOptions.isSearchable = true;
    const user = userEvent.setup();
    renderUiSelectExtendedComponent();

    const searchableRadioButton = screen.getByRole('radio', {
      name: /not searchable/i,
    });
    await user.click(searchableRadioButton);

    expect(mockSetFormField).toHaveBeenCalledWith({
      ...formField,
      questionOptions: { ...formField.questionOptions, isSearchable: false },
    });
  });
});

function renderUiSelectExtendedComponent() {
  render(
    <FormFieldProvider initialFormField={formField}>
      <UiSelectExtended />
    </FormFieldProvider>,
  );
}

import React from 'react';

void React;
