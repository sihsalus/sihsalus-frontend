import { render, screen } from '@testing-library/react';
import type { FormField } from '../../../types';
import DateField from './date.component';

const picker = vi.hoisted(() => vi.fn());
vi.mock('@openmrs/esm-framework/src/internal', () => ({
  OpenmrsDatePicker: (props: { invalidText?: string }) => {
    picker(props);
    return <div>{props.invalidText}</div>;
  },
}));
vi.mock('../../../provider/form-provider', () => ({
  useFormProviderContext: () => ({ layoutType: 'desktop', sessionMode: 'enter', workspaceLayout: 'maximized' }),
}));

it.each([false, 'false', true, 'true'])('uses the existing date policy for the calendar (%s)', (allowFutureDates) => {
  const field = {
    id: 'assessment',
    label: 'Assessment date',
    datePickerFormat: 'calendar',
    questionOptions: { rendering: 'date' },
    validators: [{ type: 'date', allowFutureDates }],
  } as FormField;
  render(
    <DateField
      field={field}
      value={null}
      errors={[{ resultType: 'error', errCode: 'invalid', message: 'Date precedes birth' }]}
      warnings={[]}
      setFieldValue={vi.fn()}
    />,
  );
  expect(screen.getByText('Date precedes birth')).toBeInTheDocument();
  const props = picker.mock.lastCall?.[0];
  expect(props.invalid).toBe(true);
  if (allowFutureDates === false || allowFutureDates === 'false') {
    expect(props.maxDate).toBeInstanceOf(Date);
  } else {
    expect(props.maxDate).toBeUndefined();
  }
});
