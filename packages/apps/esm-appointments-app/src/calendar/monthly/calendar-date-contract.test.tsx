import { formatDate, navigate } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import SelectedDateContext from '../../hooks/selectedDateContext';
import MonthlyCalendarView from './monthly-calendar-view.component';

beforeEach(() => {
  vi.stubEnv('TZ', 'America/Lima');
  expect(new Date('2026-09-01T00:00:00Z').getTimezoneOffset()).toBe(300);
});

afterEach(() => vi.unstubAllEnvs());

test.each([
  '2026-09-01',
  '2027-01-01',
  '2028-02-29',
])('keeps the month label, summary cell and daily-list link on the same local date: %s', async (selectedDate) => {
  const user = userEvent.setup();
  // Appointments 2.2.0 returns civil dates (yyyy-MM-dd) as summary keys.
  render(
    <SelectedDateContext.Provider value={{ selectedDate, setSelectedDate: vi.fn() }}>
      <MonthlyCalendarView
        appointmentServiceTypes={[]}
        events={[
          {
            appointmentDate: selectedDate,
            services: [{ serviceUuid: 'synthetic-service', serviceName: 'Synthetic service', count: 2 }],
          },
        ]}
      />
    </SelectedDateContext.Provider>,
  );
  const localDate = dayjs(selectedDate).toDate();
  expect(screen.getByText(formatDate(localDate, { day: false, time: false, noToday: true }))).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Synthetic service (2)' }));
  expect(navigate).toHaveBeenCalledWith({
    to: expect.stringContaining(`/appointments/${selectedDate}?`),
  });
  expect(vi.mocked(navigate).mock.calls.at(-1)[0].to).toContain('synthetic-service');
});
