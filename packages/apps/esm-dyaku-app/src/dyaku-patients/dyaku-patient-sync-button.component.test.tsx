import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import en from '../../translations/en.json';
import es from '../../translations/es.json';
import DyakuPatientSyncButton from './dyaku-patient-sync-button.component';
import { useDyakuSync } from './dyaku-patients.resource';

vi.mock('./dyaku-patients.resource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./dyaku-patients.resource')>()),
  useDyakuSync: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => es[key as keyof typeof es] ?? key }),
}));

const mockSync = vi.fn();
beforeEach(() => {
  mockSync.mockReset();
  vi.mocked(useDyakuSync).mockReturnValue({
    syncSinglePatient: mockSync,
    syncPatients: vi.fn(),
    isEnabled: true,
    batchSize: 50,
    intervalMinutes: 30,
  });
});

it('shows a translated actionable validation error without technical data', async () => {
  mockSync.mockResolvedValue({ success: false, synchronized: 0, failed: 1, errors: ['syncIdentityAmbiguous'] });
  render(<DyakuPatientSyncButton patient={{ resourceType: 'Patient', id: 'synthetic' }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Sincronizar paciente' }));
  expect(await screen.findByText(es.syncIdentityAmbiguous)).toBeInTheDocument();
  expect(screen.queryByText('syncIdentityAmbiguous')).not.toBeInTheDocument();
  expect(en.syncIdentityAmbiguous).not.toBe('');
});

it('never displays raw errors after a rejected sync promise', async () => {
  mockSync.mockRejectedValue(new Error('PRIVATE-ID TRACE https://private.test'));
  render(<DyakuPatientSyncButton patient={{ resourceType: 'Patient', id: 'synthetic' }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Sincronizar paciente' }));
  expect(await screen.findByText(es.syncImportFailed)).toBeInTheDocument();
  expect(document.body.textContent).not.toContain('PRIVATE');
  expect(document.body.textContent).not.toContain('https://');
});
