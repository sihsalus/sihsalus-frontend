import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateTimeField } from './date-time-field.component';

interface HarnessProps {
  defaultValue?: Date | null;
  idPrefix?: string;
}

const Harness = ({ defaultValue = null, idPrefix = 'start' }: HarnessProps) => {
  const [value, setValue] = useState<Date | null>(defaultValue);
  return (
    <div>
      <DateTimeField idPrefix={idPrefix} value={value} onChange={setValue} />
      <output data-testid="iso">{value ? value.toISOString() : ''}</output>
      <output data-testid="hours">{value ? String(value.getHours()) : ''}</output>
      <output data-testid="minutes">{value ? String(value.getMinutes()) : ''}</output>
    </div>
  );
};

const pickDate = async (user: ReturnType<typeof userEvent.setup>, date = '2026-04-27') => {
  const dateInput = screen.getByLabelText(/^date$/i);
  await user.click(dateInput);
  await user.paste(date);
};

describe('DateTimeField', () => {
  it('renders date, time, and AM/PM controls', () => {
    render(<Harness />);

    expect(screen.getByLabelText(/^date$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^time$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/am\/pm/i)).toBeInTheDocument();
  });

  it('disables the time and meridiem inputs until a date is picked', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByLabelText(/^time$/i)).toBeDisabled();
    expect(screen.getByLabelText(/am\/pm/i)).toBeDisabled();

    await pickDate(user);

    expect(screen.getByLabelText(/^time$/i)).toBeEnabled();
    expect(screen.getByLabelText(/am\/pm/i)).toBeEnabled();
  });

  it('combines a 12-hour time with the AM meridiem into a morning datetime', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await pickDate(user);
    await user.clear(screen.getByLabelText(/^time$/i));
    await user.type(screen.getByLabelText(/^time$/i), '09:15');

    expect(screen.getByTestId('hours')).toHaveTextContent('9');
    expect(screen.getByTestId('minutes')).toHaveTextContent('15');
  });

  it('flips the underlying hour by 12 when the meridiem changes from AM to PM', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await pickDate(user);
    await user.clear(screen.getByLabelText(/^time$/i));
    await user.type(screen.getByLabelText(/^time$/i), '02:30');
    expect(screen.getByTestId('hours')).toHaveTextContent('2');

    await user.selectOptions(screen.getByLabelText(/am\/pm/i), 'PM');

    expect(screen.getByTestId('hours')).toHaveTextContent('14');
    expect(screen.getByTestId('minutes')).toHaveTextContent('30');
  });

  it('treats 12:00 AM as midnight and 12:00 PM as noon', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await pickDate(user);
    await user.clear(screen.getByLabelText(/^time$/i));
    await user.type(screen.getByLabelText(/^time$/i), '12:00');
    expect(screen.getByTestId('hours')).toHaveTextContent('0');

    await user.selectOptions(screen.getByLabelText(/am\/pm/i), 'PM');
    expect(screen.getByTestId('hours')).toHaveTextContent('12');
  });

  it('ignores time input that does not match the 12-hour pattern', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await pickDate(user);
    const timeInput = screen.getByLabelText(/^time$/i);
    await user.clear(timeInput);
    await user.type(timeInput, '09:15');
    await user.clear(timeInput);
    await user.type(timeInput, '25:99');

    expect(screen.getByTestId('hours')).toHaveTextContent('9');
    expect(screen.getByTestId('minutes')).toHaveTextContent('15');
  });

  it('reflects the meridiem of the initial value (PM)', () => {
    render(<Harness defaultValue={new Date(2026, 3, 27, 14, 30)} />);

    expect(screen.getByLabelText(/am\/pm/i)).toHaveValue('PM');
    expect(screen.getByLabelText(/^time$/i)).toHaveValue('02:30');
  });

  it('reflects the meridiem of the initial value (AM at midnight)', () => {
    render(<Harness defaultValue={new Date(2026, 3, 27, 0, 0)} />);

    expect(screen.getByLabelText(/am\/pm/i)).toHaveValue('AM');
    expect(screen.getByLabelText(/^time$/i)).toHaveValue('12:00');
  });

  it('uses the idPrefix prop for the rendered control ids', () => {
    render(<Harness idPrefix="end" />);

    expect(screen.getByLabelText(/^date$/i)).toHaveAttribute('id', 'end-date');
    expect(screen.getByLabelText(/^time$/i)).toHaveAttribute('id', 'end-time');
    expect(screen.getByLabelText(/am\/pm/i)).toHaveAttribute('id', 'end-meridiem');
  });

  it('keeps the date when only the time changes', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await pickDate(user, '2026-04-27');
    await user.clear(screen.getByLabelText(/^time$/i));
    await user.type(screen.getByLabelText(/^time$/i), '09:15');

    expect(screen.getByTestId('iso')).toHaveTextContent(/^2026-04-27T/);
  });

  it('does not change the value when re-selecting the same meridiem', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await pickDate(user);
    await user.clear(screen.getByLabelText(/^time$/i));
    await user.type(screen.getByLabelText(/^time$/i), '09:15');
    const before = screen.getByTestId('iso').textContent ?? '';

    await user.selectOptions(screen.getByLabelText(/am\/pm/i), 'AM');

    expect(screen.getByTestId('iso')).toHaveTextContent(before);
  });

  it('initialises with no value when defaultValue is null', () => {
    render(<Harness defaultValue={null} />);

    expect(screen.getByTestId('iso')).toBeEmptyDOMElement();
    expect(screen.getByLabelText(/am\/pm/i)).toHaveValue('AM');
  });
});

it('keeps the visible time synchronized when the parent clears and replaces the date value', () => {
  const props = { idPrefix: 'start', onChange: () => {} };
  const view = render(<DateTimeField {...props} value={new Date(2026, 3, 27, 9, 15)} />);
  expect(screen.getByLabelText(/^time$/i)).toHaveValue('09:15');
  view.rerender(<DateTimeField {...props} value={null} />);
  expect(screen.getByLabelText(/^time$/i)).toHaveValue('');
  view.rerender(<DateTimeField {...props} value={new Date(2026, 3, 28, 0, 0)} />);
  expect(screen.getByLabelText(/^time$/i)).toHaveValue('12:00');
});

it('preserves a partial time while the parent rerenders an equivalent date', async () => {
  const onChange = vi.fn();
  const props = { idPrefix: 'start', onChange };
  const view = render(<DateTimeField {...props} value={new Date(2026, 3, 27, 9, 15)} />);
  const timeInput = screen.getByLabelText(/^time$/i);
  await userEvent.clear(timeInput);
  await userEvent.type(timeInput, '10:');
  view.rerender(<DateTimeField {...props} value={new Date(2026, 3, 27, 9, 15)} />);
  expect(timeInput).toHaveValue('10:');
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.type(timeInput, '45');
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].getHours()).toBe(10);
  expect(onChange.mock.calls[0][0].getMinutes()).toBe(45);
});

it('rehydrates the actual saved hour and meridiem when the parent supplies a changed timestamp', () => {
  const props = { idPrefix: 'end', onChange: () => {} };
  const view = render(<DateTimeField {...props} value={new Date(2026, 3, 27, 9, 15)} />);
  view.rerender(<DateTimeField {...props} value={new Date(2026, 3, 27, 18, 42)} />);
  expect(screen.getByLabelText(/^time$/i)).toHaveValue('06:42');
  expect(screen.getByLabelText(/am\/pm/i)).toHaveValue('PM');
});

it('blocks native form submission after clearing the visible time of a valid timestamp', async () => {
  const onSubmit = vi.fn((event) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <Harness defaultValue={new Date(2026, 3, 27, 9, 15)} />
      <button type="submit">Save</button>
    </form>,
  );
  await userEvent.clear(screen.getByLabelText(/^time$/i));
  expect(screen.getByTestId('hours')).toHaveTextContent('9');
  expect(screen.getByTestId('minutes')).toHaveTextContent('15');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect((screen.getByLabelText(/^time$/i) as HTMLInputElement).checkValidity()).toBe(false);
});
