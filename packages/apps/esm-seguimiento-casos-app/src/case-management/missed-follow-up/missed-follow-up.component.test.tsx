import { getUserFacingErrorMessage, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen } from '@testing-library/react';

import MissedFollowUp from './missed-follow-up.component';
import { useMissedFollowUp } from './missed-follow-up.resource';

vi.mock('./missed-follow-up.resource', () => ({ useMissedFollowUp: vi.fn() }));
vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual<typeof import('@openmrs/esm-patient-common-lib')>('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

const mutate = vi.fn();
const empty = { encounters: [], isLoading: false, isValidating: false, error: undefined, mutate };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMissedFollowUp).mockReturnValue(empty);
  vi.mocked(useConfig).mockReturnValue({
    concepts: {},
    formsList: { defaulterTracingFormUuid: 'synthetic-tracing-form' },
  });
  vi.mocked(useSession).mockReturnValue({ user: { uuid: 'synthetic-reader', privileges: [] } } as ReturnType<
    typeof useSession
  >);
  vi.mocked(userHasAccess).mockReturnValue(false);
});

it('shows a loading skeleton without offering a new follow-up', () => {
  vi.mocked(useMissedFollowUp).mockReturnValue({ ...empty, isLoading: true });
  const { container } = render(<MissedFollowUp patientUuid="synthetic-patient" />);
  expect(container.querySelector('.cds--skeleton')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument();
  expect(launchPatientWorkspace).not.toHaveBeenCalled();
});

it.each([401, 403, 500])('renders the shared safe error state for %s, not an empty history', (status) => {
  const error = Object.assign(new Error('Synthetic private backend detail'), { response: { status } });
  vi.mocked(useMissedFollowUp).mockReturnValue({ ...empty, error });
  render(<MissedFollowUp patientUuid="synthetic-patient" />);
  expect(screen.getByRole('heading', { name: 'Pérdida en el seguimiento' })).toBeInTheDocument();
  expect(getUserFacingErrorMessage).toHaveBeenCalledWith(error, expect.any(String), { log: false });
  expect(screen.queryByText(/Synthetic private backend detail|There are no/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument();
});

it('shows an empty history without a creation action for read-only access', () => {
  render(<MissedFollowUp patientUuid="synthetic-patient" />);
  expect(screen.getByText(/There are no/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument();
  expect(userHasAccess).toHaveBeenCalledWith('app:hoja.clinica.perdidaSeguimiento.editar', expect.anything());
  expect(launchPatientWorkspace).not.toHaveBeenCalled();
});

it('launches the configured form for the current patient only when modification is allowed', () => {
  vi.mocked(userHasAccess).mockImplementation(
    (privilege) => privilege === 'app:hoja.clinica.perdidaSeguimiento.editar',
  );
  const { rerender } = render(<MissedFollowUp patientUuid="patient-a" />);
  rerender(<MissedFollowUp patientUuid="patient-b" />);
  fireEvent.click(screen.getByRole('button', { name: /record/i }));
  expect(launchPatientWorkspace).toHaveBeenCalledExactlyOnceWith('patient-form-entry-workspace', {
    workspaceTitle: 'Pérdida en el seguimiento',
    mutateForm: mutate,
    formInfo: {
      encounterUuid: '',
      formUuid: 'synthetic-tracing-form',
      patientUuid: 'patient-b',
      visitTypeUuid: '',
      visitUuid: '',
    },
  });
});
