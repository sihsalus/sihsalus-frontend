import { useConfig, userHasAccess } from '@openmrs/esm-framework';
import {
  launchStartVisitPrompt,
  useLatestValidEncounter,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configSchema } from '../../config-schema';
import { useCREDFormLauncher } from '../../hooks/useCREDFormLauncher';
import AlojamientoConjunto from '../../well-child-care/components/alojamiento-conjunto/alojamiento-conjunto.component';
import NeonatalAttention from '../../well-child-care/components/neonatal-attention/neonatal-attention.component';
import NeonatalCounseling from '../../well-child-care/components/neonatal-counseling/neonatal-consuling.component';
import NeonatalEvaluation from '../../well-child-care/components/neonatal-evaluation/neonatal-evaluation.component';
import PregnancyBirthTable from '../../well-child-care/components/neonatal-register/detalles-embarazo/pregnancy-table.component';
import BirthDataTable from '../../well-child-care/components/neonatal-register/detalles-nacimiento/birth-date.component';

vi.mock('@openmrs/esm-patient-common-lib', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-patient-common-lib')>()),
  useLatestValidEncounter: vi.fn(),
  useVisitOrOfflineVisit: vi.fn(),
  launchStartVisitPrompt: vi.fn(),
}));
vi.mock('../../hooks/useCREDFormLauncher', () => ({
  useCREDFormLauncher: vi.fn(),
}));

const launchForm = vi.fn();
const mutate = vi.fn().mockResolvedValue(undefined);
const history = {
  encounter: undefined,
  isLoading: false,
  error: null,
  mutate,
} satisfies ReturnType<typeof useLatestValidEncounter>;
const existingEncounter = {
  uuid: 'synthetic-historical-encounter',
  encounterDatetime: '2026-01-01T10:00:00Z',
  patient: 'synthetic-child',
  location: 'synthetic-location',
  encounterType: { uuid: 'synthetic-perinatal-type', display: 'Perinatal' },
  form: { uuid: 'historical-form-uuid', name: 'Historical perinatal form' },
  obs: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({
    neonatalConcepts: configSchema.neonatalConcepts._default,
    encounterTypes: configSchema.encounterTypes._default,
    formsList: configSchema.formsList._default,
  });
  vi.mocked(userHasAccess).mockReturnValue(true);
  vi.mocked(useLatestValidEncounter).mockReturnValue(history);
  vi.mocked(useVisitOrOfflineVisit).mockReturnValue({
    currentVisit: { uuid: 'synthetic-visit' },
  } as ReturnType<typeof useVisitOrOfflineVisit>);
  vi.mocked(useCREDFormLauncher).mockReturnValue({
    launchForm,
    error: undefined,
    form: undefined,
    formIdentifier: 'synthetic-form',
    isLoading: false,
  });
});

describe.each([
  ['birthDetails', BirthDataTable],
  ['pregnancyDetails', PregnancyBirthTable],
  ['roomingIn', AlojamientoConjunto],
  ['atencionImmediataNewborn', NeonatalAttention],
  ['newbornNeuroEval', NeonatalEvaluation],
  ['breastfeedingObservation', NeonatalCounseling],
] as const)('CRED neonatal summary: %s', (formKey, Component) => {
  it('edits the historical encounter and refreshes only after the form confirms a save', async () => {
    vi.mocked(useLatestValidEncounter).mockReturnValue({
      ...history,
      encounter: existingEncounter,
    });
    render(<Component patientUuid="synthetic-child" />);
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(launchForm).toHaveBeenCalledWith(existingEncounter.uuid, expect.any(Function));
    expect(useCREDFormLauncher).toHaveBeenLastCalledWith(formKey, undefined, existingEncounter.form.uuid);
    expect(mutate).not.toHaveBeenCalled();
    await act(async () => {
      launchForm.mock.calls[0][1]();
    });
    expect(mutate).toHaveBeenCalledOnce();
  });

  it('creates only after an empty history has finished loading', async () => {
    vi.mocked(useLatestValidEncounter).mockReturnValue({
      ...history,
      isLoading: true,
    });
    const { rerender } = render(<Component patientUuid="synthetic-child" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    vi.mocked(useLatestValidEncounter).mockReturnValue(history);
    rerender(<Component patientUuid="synthetic-child" />);
    await userEvent.click(screen.getByRole('button', { name: /^record/i }));
    expect(launchForm).toHaveBeenCalledWith('', expect.any(Function));
  });

  it('does not expose a write action when history failed', () => {
    vi.mocked(useLatestValidEncounter).mockReturnValue({
      ...history,
      error: new Error('Synthetic read failure'),
    });
    render(<Component patientUuid="synthetic-child" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(launchForm).not.toHaveBeenCalled();
  });

  it('preserves the edit privilege guard', () => {
    vi.mocked(userHasAccess).mockReturnValue(false);
    vi.mocked(useLatestValidEncounter).mockReturnValue({
      ...history,
      encounter: existingEncounter,
    });
    render(<Component patientUuid="synthetic-child" />);
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(launchForm).not.toHaveBeenCalled();
  });

  it('disables editing while refreshing an existing record', () => {
    vi.mocked(useLatestValidEncounter).mockReturnValue({
      ...history,
      encounter: existingEncounter,
      isLoading: true,
    });
    render(<Component patientUuid="synthetic-child" />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
  });

  it('asks to start a visit before opening a form', async () => {
    vi.mocked(useVisitOrOfflineVisit).mockReturnValue({
      currentVisit: null,
    } as ReturnType<typeof useVisitOrOfflineVisit>);
    render(<Component patientUuid="synthetic-child" />);
    await userEvent.click(screen.getByRole('button', { name: /^record/i }));
    expect(launchStartVisitPrompt).toHaveBeenCalledOnce();
    expect(launchForm).not.toHaveBeenCalled();
  });
});
