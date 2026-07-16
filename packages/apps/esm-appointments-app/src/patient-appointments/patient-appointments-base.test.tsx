import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockAppointmentsData, mockPatient, patientChartBasePath, renderWithSwr } from 'test-utils';

import { type AppointmentsFetchResponse } from '../types';

import AppointmentsBase from './patient-appointments-base.component';

const testProps = {
  basePath: patientChartBasePath,
  patientUuid: mockPatient.id,
};

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockUseSession = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');

  return {
    ...actual,
    useSession: mockUseSession,
    userHasAccess: () => true,
  };
});

describe('AppointmentsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      user: { uuid: 'mock-user-uuid', display: 'Mock User' },
    });
  });

  it('opens the patient-chart appointment form with the current patient context', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: [] } as unknown as FetchResponse<AppointmentsFetchResponse>);
    renderWithSwr(<AppointmentsBase {...testProps} />);

    await userEvent.click(await screen.findByRole('button', { name: /add/i }));

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith(
      'patient-chart-appointments-form-workspace',
      expect.objectContaining({ context: 'creating', patientUuid: testProps.patientUuid }),
    );
  });

  it('renders an empty state if appointments data is unavailable', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: [],
    } as unknown as FetchResponse<AppointmentsFetchResponse>);

    renderWithSwr(<AppointmentsBase {...testProps} />);

    expect(await screen.findByRole('heading', { name: /appointments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    expect(screen.getByText(/there are no upcoming appointments to display for this patient/i)).toBeInTheDocument();
  });

  it('renders an error state if there was a problem fetching appointments data', async () => {
    const error = {
      message: 'Internal server error',
      response: {
        status: 500,
        statusText: 'Internal server error',
      },
    };

    mockOpenmrsFetch.mockRejectedValueOnce(error);

    renderWithSwr(<AppointmentsBase {...testProps} />);

    expect(await screen.findByRole('heading', { name: /appointments/i })).toBeInTheDocument();
    expect(
      screen.getByText('There was a problem displaying this information. Try reloading the page or contact support.'),
    ).toBeInTheDocument();
  });

  it(`renders a tabular overview of the patient's appointment schedule if available`, async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValueOnce({
      ...mockAppointmentsData,
    } as unknown as FetchResponse<AppointmentsFetchResponse>);

    renderWithSwr(<AppointmentsBase {...testProps} />);

    expect(await screen.findByRole('heading', { name: /appointments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();

    const upcomingAppointmentsTab = screen.getByRole('tab', { name: /upcoming/i });
    const pastAppointmentsTab = screen.getByRole('tab', { name: /past/i });

    expect(screen.getByRole('tablist')).toContainElement(upcomingAppointmentsTab);
    expect(screen.getByRole('tablist')).toContainElement(pastAppointmentsTab);
    expect(screen.getByTitle(/Empty data illustration/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no upcoming appointments to display for this patient/i)).toBeInTheDocument();

    await user.click(pastAppointmentsTab);
    expect(screen.getByRole('table')).toBeInTheDocument();

    const expectedColumnHeaders = [/date/, /location/, /service/];
    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('row').length).toEqual(7); // 7 appts in mock data + header row

    const previousPageButton = screen.getByRole('button', { name: /previous page/i });
    const nextPageButton = screen.getByRole('button', { name: /next page/i });

    expect(previousPageButton).toBeDisabled();
    expect(nextPageButton).toBeDisabled();
  });
});
