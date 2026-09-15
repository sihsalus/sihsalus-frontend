import { render, screen } from '@testing-library/react';
import Workload from './workload.component';
import { useMonthlyCalendarDistribution } from './workload.resource';

vi.mock('./workload.resource', () => ({ useMonthlyCalendarDistribution: vi.fn(() => []) }));

it.each([
  null,
  new Date(Number.NaN),
])('keeps the calendar usable after the date is cleared or incomplete (%s)', (date) => {
  const props = { serviceUuid: 'synthetic-service', onWorkloadDateChange: vi.fn() };
  const { rerender } = render(<Workload {...props} appointmentDate={new Date(2026, 8, 9)} />);
  rerender(<Workload {...props} appointmentDate={date} />);
  expect(screen.getByRole('region', { name: 'Appointment calendar' })).toBeInTheDocument();
  const month = vi.mocked(useMonthlyCalendarDistribution).mock.calls.at(-1)?.[2];
  expect(month?.getFullYear()).toBe(2026);
  expect(month?.getMonth()).toBe(8);
  rerender(<Workload {...props} appointmentDate={new Date(2026, 9, 10)} />);
  expect(vi.mocked(useMonthlyCalendarDistribution).mock.calls.at(-1)?.[2].getMonth()).toBe(9);
});
