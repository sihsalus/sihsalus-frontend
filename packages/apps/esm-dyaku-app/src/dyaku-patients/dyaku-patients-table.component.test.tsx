import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import es from '../../translations/es.json';
import {
  type DyakuPatient,
  useDyakuPatients,
  useDyakuPatientsByIdentifier,
  useDyakuSync,
} from './dyaku-patients.resource';
import DyakuPatientsTable from './dyaku-patients-table.component';

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: vi.fn(),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  useConfig: vi.fn(),
  useLayoutType: () => 'desktop',
  usePagination: (data: unknown[]) => ({ results: data, goTo: vi.fn(), currentPage: 1 }),
}));
vi.mock('./dyaku-patients.resource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./dyaku-patients.resource')>()),
  useDyakuPatients: vi.fn(),
  useDyakuPatientsByIdentifier: vi.fn(),
  useDyakuSync: vi.fn(),
}));
vi.mock('./dyaku-patients-sync.component', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => es[key as keyof typeof es] ?? key }),
}));

const patients: DyakuPatient[] = [
  {
    resourceType: 'Patient',
    id: 'synthetic-zulu',
    name: [{ given: ['Zulu'], family: 'Synthetic' }],
    identifier: [{ system: 'urn:oid:2.16.840.1.113883.3.9143.2.1.5', value: '00000002' }],
  },
  {
    resourceType: 'Patient',
    id: 'synthetic-alfa',
    name: [{ given: ['Alfa'], family: 'Synthetic' }],
    identifier: [{ system: 'urn:oid:2.16.840.1.113883.3.9143.2.1.5', value: '00000001' }],
  },
];
const syncSinglePatient = vi.fn();

beforeEach(() => {
  syncSinglePatient.mockReset().mockResolvedValue({ success: true, synchronized: 1, failed: 0, errors: [] });
  vi.mocked(useDyakuPatients).mockReturnValue({
    data: patients,
    total: 2,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  });
  vi.mocked(useDyakuPatientsByIdentifier).mockReturnValue({
    data: [],
    total: 0,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  });
  vi.mocked(useDyakuSync).mockReturnValue({
    syncSinglePatient,
    syncPatients: vi.fn(),
    isEnabled: true,
    batchSize: 50,
    intervalMinutes: 30,
  });
});

it('imports the patient displayed in the sorted row, not the previous array position', async () => {
  render(<DyakuPatientsTable />);
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Zulu');

  await userEvent.click(screen.getByRole('button', { name: 'Primer Nombre' }));
  const firstRow = within(table).getAllByRole('row')[1];
  expect(firstRow).toHaveTextContent('Alfa');
  expect(firstRow).toHaveTextContent('00000001');
  await userEvent.click(within(firstRow).getByRole('button', { name: 'Sincronizar paciente' }));
  expect(syncSinglePatient).toHaveBeenCalledExactlyOnceWith(patients[1]);

  await userEvent.click(screen.getByRole('button', { name: 'Primer Nombre' }));
  const descendingFirstRow = within(table).getAllByRole('row')[1];
  expect(descendingFirstRow).toHaveTextContent('Zulu');
  await userEvent.click(within(descendingFirstRow).getByRole('button', { name: 'Sincronizar paciente' }));
  expect(syncSinglePatient).toHaveBeenNthCalledWith(2, patients[0]);
});
