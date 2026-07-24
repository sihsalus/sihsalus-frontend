import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AppointmentsCalendarView, {
  filterCalendarEventsByServiceTypes,
} from './appointments-calendar-view.component';

describe('Appointment calendar view', () => {
  it('renders appointments in calendar view from appointments list', async () => {
    render(
      <MemoryRouter initialEntries={['/calendar/2026-07-24?services=service-one']}>
        <Routes>
          <Route path="/calendar/:date" element={<AppointmentsCalendarView />} />
        </Routes>
      </MemoryRouter>,
    );

    const expectedTableRows = [
      /John Wilson 30-Aug-2021 03:35 03:35 Dr James Cook Outpatient Walk in appointments/,
      /Neil Amstrong 10-Sept-2021 03:50 03:50 Dr James Cook Outpatient Some additional notes/,
    ];

    expectedTableRows.forEach((row) => {
      expect(screen.queryByRole('row', { name: new RegExp(row, 'i') })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('combobox', { name: /service/i })).toBeInTheDocument();
  });

  it('filters every calendar day by the selected services', () => {
    const events = [
      {
        appointmentDate: '2026-07-24',
        services: [
          { serviceName: 'General medicine', serviceUuid: 'service-one', count: 2 },
          { serviceName: 'Pediatrics', serviceUuid: 'service-two', count: 3 },
        ],
      },
      {
        appointmentDate: '2026-07-25',
        services: [{ serviceName: 'General medicine', serviceUuid: 'service-one', count: 1 }],
      },
    ];

    expect(filterCalendarEventsByServiceTypes(events, ['service-two'])).toEqual([
      {
        appointmentDate: '2026-07-24',
        services: [{ serviceName: 'Pediatrics', serviceUuid: 'service-two', count: 3 }],
      },
    ]);
    expect(filterCalendarEventsByServiceTypes(events, [])).toEqual(events);
  });
});
