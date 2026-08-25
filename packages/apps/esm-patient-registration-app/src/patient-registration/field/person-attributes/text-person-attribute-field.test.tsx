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
          <TextPersonAttributeField id="phone" personAttributeType={mockPersonAttributeType} placeholder="012345678" />
        </Form>
      </Formik>,
    );

    expect(screen.getByPlaceholderText('012345678')).toBeInTheDocument();
  });

  it('shows distinct guidance for landline and mobile phone fields', () => {
    const { rerender } = render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="phone" personAttributeType={mockPersonAttributeType} />
        </Form>
      </Formik>,
    );

    expect(screen.getByText('Enter digits only.')).toBeInTheDocument();

    rerender(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="mobilePhone" personAttributeType={mockPersonAttributeType} />
        </Form>
      </Formik>,
    );

    expect(screen.getByText(/use \+51 when including the country code/i)).toBeInTheDocument();
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

  it('does not retain a country prefix in the landline field', async () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="phone" personAttributeType={mockPersonAttributeType} />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });
    fireEvent.paste(textbox, { clipboardData: { getData: () => '+51 066-123-456' } });

    await waitFor(() => expect(textbox).toHaveValue('51066123456'));
    expect(fireEvent.keyDown(textbox, { key: '+', target: { selectionStart: 0, selectionEnd: 0 } })).toBe(false);
  });

  it('keeps regex validation for pasted phone values', async () => {
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField
            id="phone"
            personAttributeType={mockPersonAttributeType}
            validationRegex="^(?:[1-8][0-9]{7}|0[1-8][0-9]{7})$"
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

  it('rejects a value longer than the person attribute column allows', async () => {
    const user = userEvent.setup();
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="attributeId" personAttributeType={mockPersonAttributeType} maxLength={10} />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });
    await user.type(textbox, 'x'.repeat(11));
    await user.tab();

    expect(await screen.findByText(/10 characters or fewer \(11 entered\)/i)).toBeInTheDocument();
  });

  it('accepts a value exactly at the limit', async () => {
    const user = userEvent.setup();
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="attributeId" personAttributeType={mockPersonAttributeType} maxLength={10} />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });
    await user.type(textbox, 'x'.repeat(10));
    await user.tab();

    expect(screen.queryByText(/characters or fewer/i)).not.toBeInTheDocument();
  });

  it('does not silently truncate an over-long value, so the user can see what was entered', async () => {
    // This is the pasted-insurance-number case: dropping characters to fit the
    // column would lose data without the user noticing.
    const user = userEvent.setup();
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="attributeId" personAttributeType={mockPersonAttributeType} maxLength={10} />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });
    await user.type(textbox, '0'.repeat(25));

    expect(textbox).toHaveValue('0'.repeat(25));
  });

  it('falls back to the OpenMRS column width when no maxLength is configured', async () => {
    const user = userEvent.setup();
    render(
      <Formik initialValues={{}} onSubmit={() => {}}>
        <Form>
          <TextPersonAttributeField id="attributeId" personAttributeType={mockPersonAttributeType} />
        </Form>
      </Formik>,
    );

    const textbox = screen.getByRole('textbox', { name: /referred by \(optional\)/i });
    await user.type(textbox, 'x'.repeat(51));
    await user.tab();

    expect(await screen.findByText(/50 characters or fewer \(51 entered\)/i)).toBeInTheDocument();
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
