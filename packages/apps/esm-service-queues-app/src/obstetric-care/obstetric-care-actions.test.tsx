import {
  getSessionStore,
  navigate,
  showModal,
  showSnackbar,
  useConfig,
  useConnectivity,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueEntryAlice, mockSession } from 'test-utils';
import type { ConfigObject } from '../config-schema';
import { useMutateQueueEntries } from '../hooks/useQueueEntries';
import { QueueTableActionCell } from '../queue-table/cells/queue-table-action-cell.component';
import type { QueueEntry } from '../types';
import ObstetricCareActions from './obstetric-care-actions.component';
import { startObstetricCare } from './obstetric-care.resource';

vi.mock('./obstetric-care.resource', async () => ({
  ...(await vi.importActual('./obstetric-care.resource')),
  startObstetricCare: vi.fn(),
}));
vi.mock('../hooks/useQueueEntries', () => ({ useMutateQueueEntries: vi.fn() }));

const config = {
  obstetricCare: {
    enabled: true,
    outpatientAppointmentServiceUuid: 'obstetric-service',
    outpatientQueueUuid: 'outpatient-queue',
    inpatientQueueUuid: 'inpatient-queue',
  },
  concepts: { defaultTransitionStatus: 'in-service' },
} as ConfigObject;

const entry = {
  ...mockQueueEntryAlice,
  endedAt: null,
  visit: { ...mockQueueEntryAlice.visit, uuid: 'active-visit' },
  queue: { ...mockQueueEntryAlice.queue, uuid: 'outpatient-queue' },
  status: { uuid: 'triage-finished' },
  workflow: {
    appointmentUuid: 'appointment',
    appointmentServiceUuid: 'obstetric-service',
    destinationQueueUuid: 'outpatient-queue',
    isTriageQueue: false,
    triageState: 'completed',
    sisState: 'notApplicable',
    isSisStateResolved: true,
  },
} as QueueEntry;
const mutateQueueEntries = vi.fn();
let currentSession = mockSession.data;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSession).mockReturnValue(mockSession.data);
  currentSession = mockSession.data;
  vi.mocked(getSessionStore).mockReturnValue({
    getState: () => ({ loaded: true, session: currentSession }),
    getInitialState: () => ({ loaded: true, session: currentSession }),
    setState: vi.fn(),
    subscribe: vi.fn(),
    destroy: vi.fn(),
  });
  vi.mocked(useConfig).mockReturnValue(config);
  vi.mocked(useConnectivity).mockReturnValue(true);
  vi.mocked(userHasAccess).mockReturnValue(true);
  vi.mocked(useMutateQueueEntries).mockReturnValue({ mutateQueueEntries });
  vi.mocked(startObstetricCare).mockResolvedValue(entry);
  mutateQueueEntries.mockResolvedValue(undefined);
});

it('connects an outpatient obstetric row to confirmed care and its existing chart', async () => {
  const user = userEvent.setup();
  render(<QueueTableActionCell queueEntry={entry} />);
  await user.click(screen.getByRole('button', { name: 'Atender Obstetricia' }));

  expect(startObstetricCare).toHaveBeenCalledWith(entry, 'outpatient', config);
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: `/openmrs/spa/patient/${entry.patient.uuid}/chart/prenatal-care-dashboard`,
    }),
  );
  expect(mutateQueueEntries).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Transition' })).not.toBeInTheDocument();
});

it('opens Centro Obstetrico without imposing outpatient triage or insurance', async () => {
  const user = userEvent.setup();
  const inpatient = { ...entry, queue: { ...entry.queue, uuid: 'inpatient-queue' }, workflow: undefined };
  render(<QueueTableActionCell queueEntry={inpatient} />);
  await user.click(screen.getByRole('button', { name: 'Atender Obstetricia' }));
  expect(startObstetricCare).toHaveBeenCalledWith(inpatient, 'inpatient', config);
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: `/openmrs/spa/patient/${entry.patient.uuid}/chart/labour-and-delivery-dashboard`,
    }),
  );
});

it('respects postnatal permissions without requiring prenatal or delivery permissions', async () => {
  const user = userEvent.setup();
  vi.mocked(userHasAccess).mockImplementation(
    (privilege) => !String(privilege).includes('controlPrenatal') && !String(privilege).includes('partoPuerperio'),
  );
  render(<ObstetricCareActions queueEntry={entry} mode="inpatient" config={config} />);
  await user.click(screen.getByRole('button', { name: 'Atender Obstetricia' }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: `/openmrs/spa/patient/${entry.patient.uuid}/chart/postnatal-care-dashboard`,
    }),
  );
});

it.each([
  'app:hoja.clinica',
  'app:home.colasAtencion',
  'Get Visits',
  'Get Patients',
  'View Appointments',
  'Manage Queue Entries',
  'app:home.colasAtencion.editar',
])('hides care without %s', (missingPrivilege) => {
  vi.mocked(userHasAccess).mockImplementation((privilege) => privilege !== missingPrivilege);
  render(<ObstetricCareActions queueEntry={entry} mode="outpatient" config={config} />);
  expect(screen.queryByRole('button', { name: 'Atender Obstetricia' })).not.toBeInTheDocument();
});

it('does not treat administrative queue permissions as clinical authorization', () => {
  vi.mocked(userHasAccess).mockImplementation((privilege) => !String(privilege).startsWith('app:hoja.clinica.'));
  render(<ObstetricCareActions queueEntry={entry} mode="outpatient" config={config} />);
  expect(screen.queryByRole('button', { name: 'Atender Obstetricia' })).not.toBeInTheDocument();
});

it.each(['pending', 'loading', 'notRequired'] as const)('blocks outpatient care with triage %s', (triageState) => {
  render(
    <ObstetricCareActions
      queueEntry={{ ...entry, workflow: { ...entry.workflow, triageState } }}
      mode="outpatient"
      config={config}
    />,
  );
  expect(screen.getByRole('button', { name: 'Atender Obstetricia' })).toBeDisabled();
});

it('blocks a queue entry without a clinical visit', () => {
  render(<ObstetricCareActions queueEntry={{ ...entry, visit: null }} mode="inpatient" config={config} />);
  expect(screen.getByRole('button', { name: 'Atender Obstetricia' })).toBeDisabled();
});

it('disables queue changes while offline', () => {
  vi.mocked(useConnectivity).mockReturnValue(false);
  render(
    <ObstetricCareActions
      queueEntry={{ ...entry, status: { ...entry.status, uuid: 'in-service' } }}
      mode="outpatient"
      config={config}
    />,
  );
  expect(screen.getByRole('button', { name: 'Continuar atención obstétrica' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Finalizar en cola' })).toBeDisabled();
});

it('keeps navigation pending until persistence succeeds and prevents repeated submission', async () => {
  const user = userEvent.setup();
  let resolveStart: (entry: QueueEntry) => void;
  vi.mocked(startObstetricCare).mockReturnValue(new Promise((resolve) => (resolveStart = resolve)));
  render(<ObstetricCareActions queueEntry={entry} mode="outpatient" config={config} />);
  const button = screen.getByRole('button', { name: 'Atender Obstetricia' });
  await user.click(button);
  await user.click(button);
  expect(startObstetricCare).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();
  resolveStart(entry);
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
});

it('keeps failures actionable without navigating or exposing backend details', async () => {
  const user = userEvent.setup();
  vi.mocked(startObstetricCare).mockRejectedValue(new Error('internal backend diagnostic'));
  render(<ObstetricCareActions queueEntry={entry} mode="outpatient" config={config} />);
  await user.click(screen.getByRole('button', { name: 'Atender Obstetricia' }));
  await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
  expect(navigate).not.toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('internal backend diagnostic');
  expect(screen.getByRole('button', { name: 'Atender Obstetricia' })).toBeEnabled();
});

it.each([
  'unmount',
  'patient',
  'session',
  'privilege',
] as const)('does not navigate after the pending action changes %s context', async (change) => {
  const user = userEvent.setup();
  let resolveStart: (entry: QueueEntry) => void;
  vi.mocked(startObstetricCare).mockReturnValue(new Promise((resolve) => (resolveStart = resolve)));
  const { unmount, rerender } = render(<ObstetricCareActions queueEntry={entry} mode="outpatient" config={config} />);
  await user.click(screen.getByRole('button', { name: 'Atender Obstetricia' }));
  if (change === 'unmount') {
    unmount();
  } else if (change === 'patient') {
    rerender(
      <ObstetricCareActions
        queueEntry={{ ...entry, patient: { ...entry.patient, uuid: 'another-patient' } }}
        mode="outpatient"
        config={config}
      />,
    );
  } else if (change === 'session') {
    currentSession = { ...mockSession.data, user: { ...mockSession.data.user, uuid: 'another-user' } };
  } else {
    vi.mocked(userHasAccess).mockReturnValue(false);
  }
  await act(async () => resolveStart(entry));
  expect(navigate).not.toHaveBeenCalled();
  expect(showSnackbar).not.toHaveBeenCalled();
});

it('offers an explicit queue-only confirmation after care starts', async () => {
  const user = userEvent.setup();
  const attendingEntry = { ...entry, status: { ...entry.status, uuid: 'in-service' } };
  render(<ObstetricCareActions queueEntry={attendingEntry} mode="outpatient" config={config} />);
  expect(screen.getByRole('button', { name: 'Continuar atención obstétrica' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Finalizar en cola' }));
  expect(showModal).toHaveBeenCalledWith(
    'remove-queue-entry-modal',
    expect.objectContaining({ queueEntry: attendingEntry, completeCare: true }),
  );
  expect(startObstetricCare).not.toHaveBeenCalled();
});

it('preserves generic queue actions for other services and disabled configuration', () => {
  const { rerender } = render(
    <QueueTableActionCell
      queueEntry={{ ...entry, workflow: { ...entry.workflow, appointmentServiceUuid: 'other' } }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Transition' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Atender Obstetricia' })).not.toBeInTheDocument();
  vi.mocked(useConfig).mockReturnValue({ ...config, obstetricCare: { ...config.obstetricCare, enabled: false } });
  rerender(<QueueTableActionCell queueEntry={entry} />);
  expect(screen.getByRole('button', { name: 'Transition' })).toBeInTheDocument();
});

it('does not offer care for a deceased patient', () => {
  render(
    <QueueTableActionCell
      queueEntry={{ ...entry, patient: { ...entry.patient, person: { ...entry.patient.person, dead: true } } }}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Atender Obstetricia' })).not.toBeInTheDocument();
});
