import { render } from '@testing-library/react';
import React from 'react';

import PatientUpcomingAppointmentsCard from './patient-upcoming-appointments-card.component';
import { usePatientAppointments } from './patient-appointments.resource';

const mockUsePatientAppointments = vi.mocked(usePatientAppointments);

vi.mock('./patient-appointments.resource', () => ({
  usePatientAppointments: vi.fn(),
}));

const testProps = {
  patientUuid: 'test-patient-uuid',
  visitFormOpenedFrom: 'patient-chart',
  setVisitFormCallbacks: vi.fn(),
  patientChartConfig: { showUpcomingAppointments: true },
};

describe('PatientUpcomingAppointmentsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePatientAppointments.mockReturnValue({
      data: { pastAppointments: [], upcomingAppointments: [], todaysAppointments: [] },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
  });

  it('keeps the appointments search window stable across re-renders', () => {
    const { rerender } = render(<PatientUpcomingAppointmentsCard {...testProps} />);
    const [, firstStartDate] = mockUsePatientAppointments.mock.calls[0];

    rerender(<PatientUpcomingAppointmentsCard {...testProps} />);
    rerender(<PatientUpcomingAppointmentsCard {...testProps} />);

    // A startDate recomputed per render changes the SWR key each time, restarting the
    // request on every render and flooding the backend with appointments/search calls.
    for (const [, startDate] of mockUsePatientAppointments.mock.calls) {
      expect(startDate).toBe(firstStartDate);
    }
  });
});
