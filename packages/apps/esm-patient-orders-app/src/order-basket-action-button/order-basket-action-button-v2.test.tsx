import { ActionMenuButton2, UserHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import OrderBasketActionButton from './order-basket-action-button-v2.extension';

const mockActionMenuButton = vi.mocked(ActionMenuButton2);
const mockUserHasAccess = vi.mocked(UserHasAccess);

mockActionMenuButton.mockImplementation(({ label }) => <button type="button">{label}</button>);
mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');
  return {
    ...originalModule,
    useOrderBasket: () => ({ orders: [] }),
    usePatientChartStore: () => ({ patientUuid: 'patient-uuid' }),
    useStartVisitIfNeeded: () => vi.fn(),
  };
});

it('requires the basket window and orders edit privileges before offering the launcher', () => {
  render(<OrderBasketActionButton groupProps={null} />);

  expect(screen.getByRole('button', { name: /order basket/i })).toBeInTheDocument();
  // Launching starts a visit before the workspace privilege check runs, so the
  // button itself must demand everything the workspace will demand.
  expect(mockUserHasAccess.mock.calls.at(-1)?.[0]).toMatchObject({
    privilege: ['app:hoja.clinica.canastaOrdenes', 'app:hoja.clinica.ordenes.editar'],
  });
});

it('does not display the order basket when access is denied', () => {
  mockUserHasAccess.mockReturnValueOnce(null);
  render(<OrderBasketActionButton groupProps={null} />);

  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
