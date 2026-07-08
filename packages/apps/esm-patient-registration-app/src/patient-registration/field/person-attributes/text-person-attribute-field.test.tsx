import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';

import { TextPersonAttributeField } from './text-person-attribute-field.component';

describe('TextPersonAttributeField', () => {
  const mockPersonAttributeType = {
    format: 'java.lang.String',
    display: 'Referred by',
    uuid: '4dd56a75-14ab-4148-8700-1f4f704dc5b0',
    description: 'Referred by',
    name: 'Referred by',
  };

  it('renders the input field with a label', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField
            id="attributeId"
            personAttributeType={mockPersonAttributeType}
            label="Custom Label"
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByRole('textbox', { name: /custom label \(optional\)/i })).toBeInTheDocument();
  });

  it('renders the input field with the default label if label prop is not provided', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="attributeId" personAttributeType={mockPersonAttributeType} />
        </Form>
      </Formik>,
    );

    expect(screen.getByRole('textbox', { name: /referred by \(optional\)/i })).toBeInTheDocument();
  });

  it('uses the configured placeholder', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField
            id="phone"
            personAttributeType={mockPersonAttributeType}
            placeholder="012345678"
          />
        </Form>
      </Formik>,
    );

    expect(screen.getByPlaceholderText('012345678')).toBeInTheDocument();
  });

  it('allows phone field clipboard shortcuts and blocks plain invalid keystrokes', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="mobilePhone" personAttributeType={mockPersonAttributeType} />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });

    expect(fireEvent.keyDown(textbox, { key: 'v', metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(textbox, { key: 'v', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(textbox, { key: 'e' })).toBe(false);
  });

  it('sanitizes pasted phone values', async () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField
            id="mobilePhone"
            personAttributeType={mockPersonAttributeType}
            validationRegex="^(?:\\+51)?9[0-9]{8}$"
          />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });
    fireEvent.paste(textbox, { clipboardData: { getData: () => '+51 918-273-645' } });

    await waitFor(() => expect(textbox).toHaveValue('+51918273645'));
  });

  it('keeps regex validation for pasted phone values', async () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField
            id="phone"
            personAttributeType={mockPersonAttributeType}
            validationRegex="^(?:(?:\\+51)?[1-8][0-9]{7}|0[1-8][0-9]{7})$"
          />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });
    fireEvent.paste(textbox, { clipboardData: { getData: () => '999888777' } });
    fireEvent.blur(textbox);

    await waitFor(() => expect(screen.getByText(/invalid input/i)).toBeInTheDocument());
  });

  it('validates the input with the provided validationRegex', async () => {
    const user = userEvent.setup();
    const validationRegex = '^[A-Z]+$'; // Accepts only uppercase letters

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField
            id="attributeId"
            personAttributeType={mockPersonAttributeType}
            validationRegex={validationRegex}
          />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });
    expect(textbox).toBeInTheDocument();

    // Valid input: "ABC"
    await user.type(textbox, 'ABC');
    await user.tab();

    expect(screen.queryByText(/invalid input/i)).not.toBeInTheDocument();
    await user.clear(textbox);

    // // Invalid input: "abc" (contains lowercase letters)
    await user.type(textbox, 'abc');
    await user.tab();
    expect(screen.getByText(/invalid input/i)).toBeInTheDocument();
  });

  it('reports an invalid validationRegex without crashing the field', async () => {
    const user = userEvent.setup();

    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField
            id="attributeId"
            personAttributeType={mockPersonAttributeType}
            validationRegex="["
          />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });
    await user.type(textbox, 'abc');
    await user.tab();

    expect(screen.getByText(/invalid validation configuration/i)).toBeInTheDocument();
  });

  it('renders the input field as required when required prop is true', () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="attributeId" personAttributeType={mockPersonAttributeType} required />
        </Form>
      </Formik>,
    );
    const textbox = screen.getByRole('textbox', { name: /referred by/i });

    // Required attribute should be truthy on the input element
    expect(textbox).toBeInTheDocument();
    expect(textbox).toBeRequired();
  });
});
