import { launchWorkspace2, showModal, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { mapConditionProperties } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConditionsFromConceptSet } from './conditions.resource';
import ConditionsOverview from './conditions-overview.component';
import GenericConditionsOverview from './generic-conditions-overview.component';

vi.mock('react-i18next', () => {
  const t = (_key: string, defaultValue: string) => defaultValue;
  return { useTranslation: () => ({ t }) };
});
vi.mock('./conditions.resource', async () => ({
  ...(await vi.importActual('./conditions.resource')),
  useConditionsFromConceptSet: vi.fn(),
}));

const patientUuid = 'synthetic-patient';
const conditions = ['Alpha', 'Bravo', 'Echo'].map((display, index) =>
  mapConditionProperties({
    uuid: `condition-${index}`,
    patient: { uuid: patientUuid },
    condition: { coded: { uuid: `concept-${index}`, display }, nonCoded: null },
    voided: false,
    clinicalStatus: 'ACTIVE',
  }),
);

it.each([
  ConditionsOverview,
  GenericConditionsOverview,
])('targets the visible page two record and recovers after deletion refresh: %p', async (Overview) => {
  const user = userEvent.setup();
  // Carbon floating menus need a measurable box in the DOM test environment.
  const layout = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 120, 40));
  vi.mocked(useConfig).mockReturnValue({ conditionPageSize: 2 });
  vi.mocked(userHasAccess).mockReturnValue(true);
  vi.mocked(showModal).mockReturnValue(vi.fn());
  const snapshot = {
    conditions,
    conceptSet: null,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  };
  vi.mocked(useConditionsFromConceptSet).mockReturnValue(snapshot);
  const element = () => <Overview patientUuid={patientUuid} conceptSetUuid="synthetic-set" title="Antecedents" />;
  try {
    const view = render(element());
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByRole('cell', { name: 'Echo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    expect(launchWorkspace2).toHaveBeenLastCalledWith(
      'maternal-health-maternal-conditions-form-workspace',
      expect.objectContaining({
        condition: expect.objectContaining({ id: 'condition-2', source: conditions[2].source }),
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Options' }));
    await user.click(await screen.findByRole('menuitem', { name: /^Delete\b/ }));
    expect(showModal).toHaveBeenLastCalledWith(
      'maternal-health-condition-delete-confirmation-dialog',
      expect.objectContaining({ conditionId: 'condition-2', patientUuid }),
    );
    vi.mocked(useConditionsFromConceptSet).mockReturnValue({ ...snapshot, conditions: conditions.slice(0, 2) });
    view.rerender(element());
    expect(screen.getByRole('cell', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Bravo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  } finally {
    layout.mockRestore();
  }
});
