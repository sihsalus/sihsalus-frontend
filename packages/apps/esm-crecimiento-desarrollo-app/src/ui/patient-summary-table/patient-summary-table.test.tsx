import { useConfig, userHasAccess } from '@openmrs/esm-framework';
import {
  launchStartVisitPrompt,
  useLatestValidEncounter,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import { act, render, screen, within } from '@testing-library/react';
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

  it('waits for the historical form metadata before enabling editing', () => {
    vi.mocked(useLatestValidEncounter).mockReturnValue({ ...history, encounter: existingEncounter });
    vi.mocked(useCREDFormLauncher).mockReturnValue({
      launchForm,
      error: undefined,
      form: undefined,
      formIdentifier: existingEncounter.form.uuid,
      isLoading: true,
    });
    const { rerender } = render(<Component patientUuid="synthetic-child" />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^record/i })).not.toBeInTheDocument();
    vi.mocked(useCREDFormLauncher).mockReturnValue({
      launchForm,
      error: undefined,
      form: undefined,
      formIdentifier: existingEncounter.form.uuid,
      isLoading: false,
    });
    rerender(<Component patientUuid="synthetic-child" />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeEnabled();
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

it('shows declared birth measurement units, preserves zero scores and leaves missing values empty', () => {
  vi.mocked(useLatestValidEncounter).mockReturnValue({
    ...history,
    encounter: {
      ...existingEncounter,
      obs: [
        {
          uuid: 'synthetic-birth-weight',
          concept: { uuid: configSchema.neonatalConcepts._default.birthWeightUuid, display: 'Birth weight' },
          groupMembers: [],
          value: 3.25,
        },
        {
          uuid: 'synthetic-apgar',
          concept: { uuid: configSchema.neonatalConcepts._default.apgar1MinUuid, display: 'APGAR' },
          groupMembers: [],
          value: 0,
        },
      ],
    },
  });

  render(<BirthDataTable patientUuid="synthetic-child" />);
  expect(screen.getByText('3.25 kg')).toBeInTheDocument();
  expect(screen.getByText('0 puntos')).toBeInTheDocument();
  expect(screen.queryByText('-- cm')).not.toBeInTheDocument();
});

it('keeps esophageal and anal observations distinct when the published form uses the same concept', async () => {
  vi.mocked(useLatestValidEncounter).mockReturnValue({
    ...history,
    encounter: {
      ...existingEncounter,
      obs: [
        {
          uuid: 'synthetic-esophageal-obs',
          concept: {
            uuid: configSchema.neonatalConcepts._default.esophagusPermeabilityUuid,
          },
          groupMembers: [],
          value: {
            uuid: 'synthetic-esophagus-answer',
            display: 'Synthetic esophageal result',
          },
          formFieldNamespace: 'rfe-forms',
          formFieldPath: 'rfe-forms-permeabilidadEsofago',
        },
        {
          uuid: 'synthetic-anal-obs',
          concept: {
            uuid: configSchema.neonatalConcepts._default.esophagusPermeabilityUuid,
          },
          groupMembers: [],
          value: {
            uuid: 'synthetic-anal-answer',
            display: 'Synthetic anal result',
          },
          formFieldNamespace: 'rfe-forms',
          formFieldPath: 'rfe-forms-permeabilidadAnal',
        },
      ],
    },
  });
  render(<NeonatalEvaluation patientUuid="synthetic-child" />);
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
  const esophagealRow = screen.getByText(/Permeabilidad Esófago/i).closest('tr');
  const analRow = screen.getByText(/Permeabilidad Anal/i).closest('tr');
  expect(within(esophagealRow).getByText('Synthetic esophageal result')).toBeInTheDocument();
  expect(within(analRow).getByText('Synthetic anal result')).toBeInTheDocument();
});

it('does not assign an unidentifiable historical permeability value to either anatomical field', async () => {
  vi.mocked(useLatestValidEncounter).mockReturnValue({
    ...history,
    encounter: {
      ...existingEncounter,
      obs: [
        {
          uuid: 'synthetic-legacy-permeability',
          concept: {
            uuid: configSchema.neonatalConcepts._default.esophagusPermeabilityUuid,
          },
          groupMembers: [],
          value: 'Synthetic unidentified result',
        },
      ],
    },
  });
  render(<NeonatalEvaluation patientUuid="synthetic-child" />);
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.queryByText('Synthetic unidentified result')).not.toBeInTheDocument();
  expect(screen.getAllByText('Review the original form')).toHaveLength(2);
  expect(screen.getByRole('button', { name: /edit/i })).toBeEnabled();
});
