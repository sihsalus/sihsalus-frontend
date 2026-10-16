import { render, screen } from '@testing-library/react';

import CareSummaryTable from './care-summary-table.component';

vi.mock('@openmrs/esm-patient-common-lib', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-patient-common-lib')>()),
  useVisitOrOfflineVisit: () => ({ currentVisit: null }),
  ErrorState: ({ headerTitle }: { headerTitle: string }) => <div role="alert">Unable to load {headerTitle}</div>,
  EmptyState: () => <div>Confirmed empty history</div>,
}));

vi.mock('../../hooks/useMaternalFormLauncher', () => ({
  useMaternalFormIdentifierLauncher: () => ({ launchForm: vi.fn() }),
}));

const props = {
  patientUuid: 'synthetic-mother',
  title: 'Prenatal controls',
  emptyStateText: 'No controls',
  formUuid: 'synthetic-form',
  editPrivilege: 'synthetic-edit',
  rowDefinitions: [],
};

it('shows a failed history as an error rather than an empty editable record', () => {
  render(
    <CareSummaryTable
      {...props}
      useEncountersHook={() => ({
        prenatalEncounters: [],
        isValidating: false,
        mutate: vi.fn(),
        error: new Error('synthetic failure'),
      })}
    />,
  );
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.queryByText('Confirmed empty history')).not.toBeInTheDocument();
});

it('waits for initial history instead of offering to create a duplicate', () => {
  render(
    <CareSummaryTable
      {...props}
      useEncountersHook={() => ({ prenatalEncounters: [], isValidating: true, mutate: vi.fn() })}
    />,
  );
  expect(screen.getByRole('progressbar')).toBeVisible();
  expect(screen.queryByText('Confirmed empty history')).not.toBeInTheDocument();
});
