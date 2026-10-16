import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import ObstetricHistoryBase from './obstetric-history-base';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key) }),
}));
vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../hooks/useMaternalFormLauncher', () => ({
  useMaternalFormLauncher: () => ({ launchForm: vi.fn() }),
}));
vi.mock('../../hooks/usePrenatalAntecedents', () => ({
  usePrenatalAntecedents: () => ({
    data: [{ id: 'synthetic-history', date: '2026-10-01', gravidez: 2, partoAborto: 0 }],
    isLoading: false,
    isValidating: false,
    error: null,
    mutate: vi.fn(),
  }),
}));

it('offers visible view controls and switches recorded zero and unknown values between diagram and table', async () => {
  const user = userEvent.setup();
  render(<ObstetricHistoryBase patientUuid="synthetic-mother" />);

  const tableSwitch = screen.getByRole('tab', { name: /Table view/i });
  const chartSwitch = screen.getByRole('tab', { name: /Chart view/i });
  expect(tableSwitch.querySelector('svg')).toBeInTheDocument();
  expect(chartSwitch.querySelector('svg')).toBeInTheDocument();
  expect(chartSwitch).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('img')).toBeInTheDocument();

  await user.click(tableSwitch);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  const table = screen.getByRole('table');
  const rows = within(table).getAllByRole('row');
  expect(rows).toHaveLength(12);
  expect(within(screen.getByRole('row', { name: 'abortions 0' })).getByText('0')).toBeInTheDocument();
  expect(
    within(screen.getByRole('row', { name: 'births obstetricNotRecorded' })).getByText('obstetricNotRecorded'),
  ).toBeInTheDocument();

  await user.click(chartSwitch);
  expect(screen.getByRole('img')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
