import { launchWorkspace2, showModal, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { mapConditionProperties } from '@openmrs/esm-patient-common-lib';
import { render, screen, within } from '@testing-library/react';
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
const conditions = ['Zulu', 'Alpha', 'Bravo', 'Echo', 'Foxtrot'].map((display, index) =>
  mapConditionProperties({
    uuid: `condition-${index}`,
    patient: { uuid: patientUuid },
    condition: { coded: { uuid: `concept-${index}`, display }, nonCoded: null },
    voided: false,
    clinicalStatus: index === 4 ? 'RESOLVED' : 'ACTIVE',
  }),
);

describe.each([
  ['pathological', () => <ConditionsOverview patientUuid={patientUuid} />],
  [
    'generic',
    () => <GenericConditionsOverview patientUuid={patientUuid} conceptSetUuid="synthetic-set" title="Antecedents" />,
  ],
] as const)('%s antecedent table', (_name, element) => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Carbon positions floating menus only after measuring a nonzero layout box.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 120, 40));
    vi.mocked(useConfig).mockReturnValue({
      conditionPageSize: 2,
      conditionConceptSets: { antecedentesPatologicos: { uuid: 'synthetic-set' } },
    });
    vi.mocked(userHasAccess).mockReturnValue(true);
    vi.mocked(showModal).mockReturnValue(vi.fn());
    vi.mocked(useConditionsFromConceptSet).mockReturnValue({
      conditions,
      conceptSet: null,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('edits and deletes the visible record on page two after sorting and a data refresh', async () => {
    const user = userEvent.setup();
    const view = render(element());
    await user.click(screen.getByRole('button', { name: /next page/i }));

    const assertVisibleActions = async () => {
      const row = screen.getAllByRole('row')[1];
      const display = within(row).getAllByRole('cell')[0].textContent;
      const expected = conditions.find((condition) => condition.display === display);
      expect(expected).toBeDefined();
      await user.click(within(row).getByRole('button', { name: 'Options' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
      expect(launchWorkspace2).toHaveBeenLastCalledWith(
        'maternal-conditions-form-workspace',
        expect.objectContaining({ condition: expect.objectContaining({ id: expected?.id, source: expected?.source }) }),
      );
      await user.click(within(row).getByRole('button', { name: 'Options' }));
      await user.click(await screen.findByRole('menuitem', { name: /^Delete\b/ }));
      expect(showModal).toHaveBeenLastCalledWith(
        'cred-condition-delete-confirmation-dialog',
        expect.objectContaining({ conditionId: expected?.id, patientUuid }),
      );
    };

    expect(screen.getByRole('cell', { name: 'Bravo' })).toBeInTheDocument();
    await assertVisibleActions();
    await user.click(within(screen.getByRole('columnheader', { name: /condition/i })).getByRole('button'));
    expect(screen.getByRole('cell', { name: 'Zulu' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Echo' })).toBeInTheDocument();
    await assertVisibleActions();
    await user.click(within(screen.getByRole('columnheader', { name: /condition/i })).getByRole('button'));
    expect(screen.getByRole('cell', { name: 'Alpha' })).toBeInTheDocument();
    await assertVisibleActions();
    await user.click(within(screen.getByRole('columnheader', { name: /condition/i })).getByRole('button'));
    expect(screen.getByRole('cell', { name: 'Echo' })).toBeInTheDocument();
    const snapshot = vi.mocked(useConditionsFromConceptSet).mock.results[0].value;
    vi.mocked(useConditionsFromConceptSet).mockReturnValue({ ...snapshot, conditions: [...conditions].reverse() });
    view.rerender(element());
    await assertVisibleActions();
  });

  it('shows the remaining history when refresh removes the last records on page two', async () => {
    const user = userEvent.setup();
    const view = render(element());
    await user.click(screen.getByRole('button', { name: /next page/i }));
    const snapshot = vi.mocked(useConditionsFromConceptSet).mock.results[0].value;
    vi.mocked(useConditionsFromConceptSet).mockReturnValue({ ...snapshot, conditions: conditions.slice(0, 2) });
    view.rerender(element());
    expect(screen.getByRole('cell', { name: 'Zulu' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('returns to the first page when switching from active to inactive history', async () => {
    const user = userEvent.setup();
    render(element());
    await user.click(screen.getByRole('button', { name: /next page/i }));
    await user.click(screen.getByRole('combobox', { name: /show/i }));
    await user.click(screen.getByRole('option', { name: 'Inactive' }));
    expect(screen.getByRole('cell', { name: 'Foxtrot' })).toBeInTheDocument();
  });
});
