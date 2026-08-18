import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StartVisitButton2 from './start-visit-button2.component';

const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockShowSnackbar = vi.mocked(showSnackbar);

describe('StartVisitButton2', () => {
  it('keeps the selected patient visible in the visit workspace', async () => {
    const user = userEvent.setup();
    const launchChildWorkspace = vi.fn().mockResolvedValue(undefined);
    const patient: fhir.Patient = {
      id: 'patient-uuid',
      resourceType: 'Patient',
      name: [{ given: ['Marita'], family: 'Diaz Diaz' }],
    };

    render(
      <StartVisitButton2
        launchChildWorkspace={launchChildWorkspace}
        patient={patient}
        patientUuid="patient-uuid"
        startVisitWorkspaceName="start-visit-workspace"
      />,
    );

    await user.click(screen.getByRole('button', { name: /start visit/i }));

    expect(launchChildWorkspace).toHaveBeenCalledWith(
      'start-visit-workspace',
      expect.objectContaining({
        patient,
        patientUuid: 'patient-uuid',
        showPatientHeader: true,
      }),
    );
  });

  it('normalizes technical errors before showing them', async () => {
    const user = userEvent.setup();
    const technicalError = new Error('POST /visit failed with SQL timeout');
    const launchChildWorkspace = vi.fn().mockRejectedValue(technicalError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetUserFacingErrorMessage.mockReturnValue('No se pudo iniciar la consulta.');

    render(
      <StartVisitButton2
        launchChildWorkspace={launchChildWorkspace}
        patient={{ id: 'patient-uuid', resourceType: 'Patient' }}
        patientUuid="patient-uuid"
        startVisitWorkspaceName="start-visit-workspace"
      />,
    );

    await user.click(screen.getByRole('button', { name: /start visit/i }));

    await waitFor(() => {
      expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
        technicalError,
        'An error occurred while starting the visit',
        { log: false },
      );
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ subtitle: 'No se pudo iniciar la consulta.' }),
      );
    });
    consoleError.mockRestore();
  });
});
