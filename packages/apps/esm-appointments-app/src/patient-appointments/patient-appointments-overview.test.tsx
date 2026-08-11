import { launchWorkspace2, usePatient, userHasAccess, useSession } from '@openmrs/esm-framework';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mockPatient } from 'test-utils';

import PatientAppointmentsOverview from './patient-appointments-overview.component';

const mockLaunchWorkspace = vi.mocked(launchWorkspace2);
const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

vi.mock('./patient-appointments-base.component', () => ({
  default: () => <div>Appointments</div>,
}));

vi.mock('./patient-appointments-header', () => ({
  default: () => <div>Patient header</div>,
}));

function renderOverview(search = '?action=create') {
  return render(
    <MemoryRouter initialEntries={[`/patient/${mockPatient.id}${search}`]}>
      <Routes>
        <Route path="/patient/:patientUuid" element={<PatientAppointmentsOverview />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PatientAppointmentsOverview appointment creation handoff', () => {
  beforeEach(() => {
    mockUsePatient.mockReturnValue({
      patient: mockPatient,
      patientUuid: mockPatient.id,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePatient>);
    mockUseSession.mockReturnValue({ user: { uuid: 'admission-user' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation(
      (privileges) =>
        Array.isArray(privileges) &&
        privileges.includes('app:home.citas') &&
        privileges.includes('app:home.citas.editar'),
    );
  });

  it('opens a new appointment workspace for the selected patient', async () => {
    renderOverview();

    await waitFor(() =>
      expect(mockLaunchWorkspace).toHaveBeenCalledWith('appointments-form-workspace', {
        context: 'creating',
        patientUuid: mockPatient.id,
      }),
    );
  });

  it('does not honor a forged creation request without the appointment edit privilege', () => {
    mockUserHasAccess.mockReturnValue(false);

    renderOverview();

    expect(mockLaunchWorkspace).not.toHaveBeenCalled();
  });
});
