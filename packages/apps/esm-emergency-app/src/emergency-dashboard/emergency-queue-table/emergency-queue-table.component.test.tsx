import { getDefaultsFromConfigSchema, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Config, configSchema } from '../../config-schema';
import { type EmergencyQueueEntry, useEmergencyQueueEntries } from '../../resources/emergency.resource';
import EmergencyQueueTable from './emergency-queue-table.component';

vi.mock('../../resources/emergency.resource', () => ({ useEmergencyQueueEntries: vi.fn() }));
vi.mock('./emergency-queue-columns.resource', () => ({
  useEmergencyQueueColumns: () => [
    {
      key: 'patient',
      header: 'Patient',
      CellComponent: ({ queueEntry }: { queueEntry: EmergencyQueueEntry }) => <span>{queueEntry.patient.display}</span>,
      getFilterableValue: (queueEntry: EmergencyQueueEntry) => queueEntry.patient.display,
    },
  ],
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const mockUseQueueEntries = vi.mocked(useEmergencyQueueEntries);

function makeEntry(index: number): EmergencyQueueEntry {
  return {
    uuid: `synthetic-entry-${index}`,
    patient: { uuid: `synthetic-patient-${index}`, display: `Synthetic patient ${index}` },
    priority: { uuid: config.concepts.emergencyConceptUuid, display: 'Emergency' },
    status: { uuid: 'waiting', display: 'Waiting' },
    providerWaitingFor: { uuid: 'synthetic-provider', display: 'Synthetic provider' },
    queue: { uuid: 'synthetic-queue', display: 'Synthetic queue' },
    startedAt: new Date(Date.now() - (60 - index) * 60_000).toISOString(),
    sortWeight: 1,
  };
}

function setEntries(entries: EmergencyQueueEntry[], error?: Error) {
  mockUseQueueEntries.mockReturnValue({
    queueEntries: entries,
    isLoading: false,
    error,
    isValidating: false,
  } as ReturnType<typeof useEmergencyQueueEntries>);
}

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue(config);
  vi.mocked(userHasAccess).mockReturnValue(false);
  setEntries([makeEntry(1), { ...makeEntry(2), status: { uuid: 'in-service', display: 'In service' } }]);
});

it('shows a loading error without describing a failed request as an empty queue', () => {
  setEntries([], new Error('Synthetic queue catalog failure'));
  render(<EmergencyQueueTable />);

  expect(screen.getByText('Error State')).toBeInTheDocument();
  expect(screen.queryByText('No patients to display')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('finds a patient when a pasted search has surrounding whitespace', async () => {
  const user = userEvent.setup();
  render(<EmergencyQueueTable />);

  await user.type(screen.getByRole('searchbox'), '  synthetic PATIENT 1  ');

  expect(screen.getByText('Synthetic patient 1')).toBeInTheDocument();
  expect(screen.queryByText('Synthetic patient 2')).not.toBeInTheDocument();
});

it.each([
  ['Show patients with status:', 'Waiting'],
  ['Prioridad:', 'Emergency'],
  ['Prestador:', 'Synthetic provider'],
  ['Identificación:', 'Confirmado'],
  ['Tiempo de espera:', '10 - 60 min'],
])('clears the selected value shown by %s', async (filterLabel, option) => {
  const user = userEvent.setup();
  render(<EmergencyQueueTable />);
  const dropdown = screen.getByRole('combobox', { name: filterLabel });

  await user.click(dropdown);
  await user.click(screen.getByRole('option', { name: option }));
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

  expect(dropdown).toHaveTextContent('All');
  expect(dropdown).not.toHaveTextContent(option);
  expect(screen.getByText('Synthetic patient 1')).toBeInTheDocument();
  expect(screen.getByText('Synthetic patient 2')).toBeInTheDocument();
});

it('clears both search text and dropdown filters', async () => {
  const user = userEvent.setup();
  render(<EmergencyQueueTable />);
  const search = screen.getByRole('searchbox');

  await user.click(screen.getByRole('combobox', { name: 'Show patients with status:' }));
  await user.click(screen.getByRole('option', { name: 'In service' }));
  await user.type(search, 'Synthetic patient 1');
  expect(screen.getByText('No patients to display')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

  expect(search).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Show patients with status:' })).toHaveTextContent('All');
  expect(screen.getByText('Synthetic patient 1')).toBeInTheDocument();
  expect(screen.getByText('Synthetic patient 2')).toBeInTheDocument();
});

it('keeps an active provider filter visible when refreshed entries no longer have that provider', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<EmergencyQueueTable />);
  await user.click(screen.getByRole('combobox', { name: 'Prestador:' }));
  await user.click(screen.getByRole('option', { name: 'Synthetic provider' }));

  setEntries([{ ...makeEntry(1), providerWaitingFor: null }]);
  rerender(<EmergencyQueueTable />);

  expect(screen.getByRole('combobox', { name: 'Prestador:' })).toHaveTextContent('Synthetic provider');
  expect(screen.getByText('No patients to display')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(screen.getByText('Synthetic patient 1')).toBeInTheDocument();
});

it('returns to page one when search text keeps the same number of pages', async () => {
  const user = userEvent.setup();
  setEntries(Array.from({ length: 20 }, (_, index) => makeEntry(index + 1)));
  render(<EmergencyQueueTable />);
  await user.click(screen.getByRole('button', { name: 'Next page' }));

  await user.type(screen.getByRole('searchbox'), 'Synthetic patient 1');

  expect(screen.getByText('Synthetic patient 1')).toBeInTheDocument();
  expect(screen.queryByText('Synthetic patient 19')).not.toBeInTheDocument();
});

it('returns to page one when filtering keeps the same number of pages', async () => {
  const user = userEvent.setup();
  setEntries(
    Array.from({ length: 20 }, (_, index) => ({
      ...makeEntry(index + 1),
      status: { uuid: index < 11 ? 'waiting' : 'in-service', display: index < 11 ? 'Waiting' : 'In service' },
    })),
  );
  render(<EmergencyQueueTable />);
  await user.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('Synthetic patient 11')).toBeInTheDocument();

  await user.click(screen.getByRole('combobox', { name: 'Show patients with status:' }));
  await user.click(screen.getByRole('option', { name: 'Waiting' }));

  expect(screen.getByText('Synthetic patient 1')).toBeInTheDocument();
  expect(screen.queryByText('Synthetic patient 11')).not.toBeInTheDocument();
});

it('preserves a valid page when refreshed queue data adds another page', async () => {
  const user = userEvent.setup();
  const entries = Array.from({ length: 20 }, (_, index) => makeEntry(index + 1));
  setEntries(entries);
  const { rerender } = render(<EmergencyQueueTable />);
  await user.click(screen.getByRole('button', { name: 'Next page' }));

  setEntries([...entries, makeEntry(21)]);
  rerender(<EmergencyQueueTable />);

  expect(screen.getByText('Synthetic patient 11')).toBeInTheDocument();
  expect(screen.queryByText('Synthetic patient 1')).not.toBeInTheDocument();
});

it('recovers to a valid page when refreshed queue data removes the last page', async () => {
  const user = userEvent.setup();
  const entries = Array.from({ length: 11 }, (_, index) => makeEntry(index + 1));
  setEntries(entries);
  const { rerender } = render(<EmergencyQueueTable />);
  await user.click(screen.getByRole('button', { name: 'Next page' }));

  setEntries(entries.slice(0, 10));
  rerender(<EmergencyQueueTable />);

  expect(within(screen.getByRole('table')).getByText('Synthetic patient 1')).toBeInTheDocument();
  expect(screen.queryByText('No patients to display')).not.toBeInTheDocument();
});
