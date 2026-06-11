import { usePersonAttributeTypes } from '@hooks/usePersonAttributeTypes';
import type { FormField } from '@sihsalus/esm-form-engine-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PersonAttributeType } from '@types';
import React from 'react';
import { FormFieldProvider } from '../../../../form-field-context';
import PersonAttributeTypeQuestion from './person-attribute-type-question.component';

void React;

const mockSetFormField = vi.fn();
const formField: FormField = {
  id: '1',
  type: 'personAttribute',
  questionOptions: {
    rendering: 'text',
  },
};

vi.mock('../../../../form-field-context', async () => ({
  ...(await vi.importActual('../../../../form-field-context')),
  useFormField: () => ({ formField, setFormField: mockSetFormField }),
}));

const mockUsePersonAttributeTypes = vi.mocked(usePersonAttributeTypes);
vi.mock('@hooks/usePersonAttributeTypes', async () => ({
  ...(await vi.importActual('@hooks/usePersonAttributeTypes')),
  usePersonAttributeTypes: vi.fn((value: string) => value),
}));

const personAttributeTypes: Array<PersonAttributeType> = [
  { display: 'Email', format: 'java.lang.String', uuid: '1', concept: { uuid: 'c1', display: 'Email', answers: [] } },
  {
    display: 'Phone Number',
    format: 'java.lang.String',
    uuid: '2',
    concept: { uuid: 'c2', display: 'Phone Number', answers: [] },
  },
];

describe('PersonAttributeTypeQuestion', () => {
  beforeEach(() => {
    mockSetFormField.mockClear();
    formField.questionOptions = {
      rendering: 'text',
    };
  });

  it('renders without crashing and displays the person attribute types', async () => {
    mockUsePersonAttributeTypes.mockReturnValue({
      personAttributeTypes,
      personAttributeTypeLookupError: null,
      isLoadingPersonAttributeTypes: false,
    });
    const user = userEvent.setup();
    renderComponent();

    expect(screen.getByText(/search for a backing person attribute type/i)).toBeInTheDocument();
    expect(
      screen.getByText(/person attribute type fields must be linked to a person attribute type/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open/i }));

    expect(screen.getByText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/phone number/i)).toBeInTheDocument();
  });

  it('shows spinner when loading the person attribute types', () => {
    mockUsePersonAttributeTypes.mockReturnValue({
      personAttributeTypes: [],
      personAttributeTypeLookupError: null,
      isLoadingPersonAttributeTypes: true,
    });
    renderComponent();

    expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('displays an error if person attribute types cannot be loaded', () => {
    mockUsePersonAttributeTypes.mockReturnValue({
      personAttributeTypes: [],
      personAttributeTypeLookupError: Error(),
      isLoadingPersonAttributeTypes: false,
    });
    renderComponent();

    expect(screen.getByText(/error fetching person attribute types/i)).toBeInTheDocument();
    expect(screen.getByText(/please try again\./i)).toBeInTheDocument();
  });

  it('shows the selected person attribute type', () => {
    mockUsePersonAttributeTypes.mockReturnValue({
      personAttributeTypes,
      personAttributeTypeLookupError: null,
      isLoadingPersonAttributeTypes: false,
    });
    formField.questionOptions.attributeType = personAttributeTypes[0].uuid;
    renderComponent();

    expect(screen.getByRole('button', { name: /clear selected item/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveDisplayValue(/email/i);
  });

  it('calls setFormField with the selected attributeType', async () => {
    mockUsePersonAttributeTypes.mockReturnValue({
      personAttributeTypes,
      personAttributeTypeLookupError: null,
      isLoadingPersonAttributeTypes: false,
    });
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: /open/i }));
    await user.click(screen.getByText(/email/i));

    expect(mockSetFormField).toHaveBeenCalledWith(
      expect.objectContaining({
        questionOptions: expect.objectContaining({
          attributeType: '1',
        }),
      }),
    );
  });
});

function renderComponent() {
  render(
    <FormFieldProvider initialFormField={formField}>
      <PersonAttributeTypeQuestion />
    </FormFieldProvider>,
  );
}
