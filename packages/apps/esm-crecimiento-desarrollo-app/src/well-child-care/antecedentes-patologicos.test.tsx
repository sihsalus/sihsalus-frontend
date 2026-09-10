import { launchWorkspace2, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { mapConditionProperties } from '@openmrs/esm-patient-common-lib';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConditionsFromConceptSet } from '../ui/conditions-filter/conditions.resource';
import ConditionsOverview from '../ui/conditions-filter/conditions-overview.component';
import GenericConditionsOverview from '../ui/conditions-filter/generic-conditions-overview.component';
import AntecedentesPatologicos from './antecedentes-patologicos.component';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, defaultValue: string) => defaultValue }),
}));

vi.mock('../ui/conditions-filter/conditions.resource', async () => ({
  ...(await vi.importActual('../ui/conditions-filter/conditions.resource')),
  useConditionsFromConceptSet: vi.fn(),
}));

const patientUuid = 'synthetic-patient';
const conditions = [
  'pathological',
  undefined,
  'family',
  'social',
  'surgical',
  'previous-hospitalization',
  'other',
  'definitive-diagnosis',
].map((type, index) =>
  mapConditionProperties({
    uuid: `synthetic-condition-${index}`,
    patient: { uuid: patientUuid },
    condition: { coded: { uuid: 'synthetic-anemia-concept', display: 'Anemia' } },
    clinicalStatus: 'ACTIVE',
    additionalDetail: type ? `__sihsalus_antecedent_type:${type}` : null,
    voided: false,
  }),
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 120, 40));
  vi.mocked(useConfig).mockReturnValue({
    conditionPageSize: 20,
    conditionConceptSets: {
      antecedentesPatologicos: { uuid: 'synthetic-set', title: 'Antecedentes Patológicos del Menor' },
    },
  });
  vi.mocked(userHasAccess).mockReturnValue(true);
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

it.each([
  ['antecedentesPatologicos', AntecedentesPatologicos],
  ['childMedicalHistory', ConditionsOverview],
] as const)('%s does not turn a family history of anemia into pathology of the child', async (_entry, Overview) => {
  const user = userEvent.setup();
  render(<Overview patientUuid={patientUuid} />);

  const patientPathology = [conditions[0], conditions[1], conditions[7]];
  expect(screen.getAllByRole('cell', { name: 'Anemia' })).toHaveLength(patientPathology.length);
  const rows = screen.getAllByRole('row').slice(1);
  for (const [index, row] of rows.entries()) {
    await user.click(within(row).getByRole('button', { name: 'Options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    expect(launchWorkspace2).toHaveBeenLastCalledWith(
      'maternal-conditions-form-workspace',
      expect.objectContaining({ condition: patientPathology[index] }),
    );
  }
});

it('leaves a generic concept-set consumer unfiltered unless it requests the clinical scope', () => {
  render(<GenericConditionsOverview patientUuid={patientUuid} conceptSetUuid="synthetic-set" title="Antecedents" />);
  expect(screen.getAllByRole('cell', { name: 'Anemia' })).toHaveLength(conditions.length);
});
