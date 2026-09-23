import { launchWorkspace2, openmrsFetch, useConfig, usePatient, userHasAccess } from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { formEntryWorkspace } from '../../types';
import CREDFormsSelectorWorkspace from './cred-forms-selector.workspace';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

type ApiResponse = Awaited<ReturnType<typeof openmrsFetch>>;
const response = (results: unknown[]) => ({ data: { results } }) as ApiResponse;
const form = {
  uuid: '00000000-0000-4000-8000-000000000057',
  name: 'Synthetic CRED follow-up',
  display: 'Synthetic CRED follow-up',
  version: '1',
  published: true,
  retired: false,
  resources: [],
};
const encounters = [
  { uuid: 'control-one', form, encounterDatetime: '2026-06-01T10:00:00Z' },
  { uuid: 'control-two', form, encounterDatetime: '2026-07-01T10:00:00Z' },
];
const controlNumbers = [
  { uuid: 'control-one-number', value: 1, encounter: { uuid: 'control-one' } },
  { uuid: 'control-two-number', value: 2, encounter: { uuid: 'control-two' } },
];
let readEncounters: () => Promise<ApiResponse>;
let readControlNumbers: () => Promise<ApiResponse>;

function renderSelector() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
      <CREDFormsSelectorWorkspace
        patientUuid="synthetic-child"
        controlNumber={1}
        consultationDatetime="2026-06-01T10:00:00Z"
        availableForms={[{ form, associatedEncounters: [] }]}
        closeWorkspace={vi.fn().mockResolvedValue(true)}
      />
    </SWRConfig>,
  );
}

async function openForm() {
  const link = await screen.findByText(form.display);
  await waitFor(() => expect(link).toBeVisible());
  await userEvent.click(link);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({
    formsList: { stimulationFollowupForm: form.uuid },
    CRED: { controlNumber: 'synthetic-control-number' },
  });
  vi.mocked(usePatient).mockReturnValue({ patient: undefined } as ReturnType<typeof usePatient>);
  vi.mocked(userHasAccess).mockReturnValue(true);
  readEncounters = async () => response(encounters);
  readControlNumbers = async () => response(controlNumbers);
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    const path = String(url).split('?')[0];
    if (path.endsWith('/encounter')) return readEncounters();
    if (path.endsWith('/obs')) return readControlNumbers();
    if (path.endsWith(`/form/${form.uuid}`)) return { data: form } as ApiResponse;
    throw new Error('Unexpected request in synthetic fixture');
  });
});

it.each(['encounters', 'control numbers'])('waits for %s before offering a form', async (pending) => {
  let finishRead!: (value: ApiResponse) => void;
  const pendingRead = new Promise<ApiResponse>((resolve) => {
    finishRead = resolve;
  });
  if (pending === 'encounters') readEncounters = () => pendingRead;
  else readControlNumbers = () => pendingRead;
  renderSelector();

  expect(await screen.findByText('Cargando datos...')).toBeVisible();
  expect(screen.queryByRole('table', { name: 'forms' })).not.toBeInTheDocument();
  expect(launchWorkspace2).not.toHaveBeenCalled();
  await act(async () => finishRead(response(pending === 'encounters' ? encounters : controlNumbers)));
  await openForm();
  await waitFor(() =>
    expect(launchWorkspace2).toHaveBeenCalledWith(
      formEntryWorkspace,
      expect.objectContaining({ encounterUuid: 'control-one' }),
    ),
  );
});

it.each([
  'encounters',
  'control numbers',
])('blocks creation after a failed %s read and recovers on retry', async (failed) => {
  const rejectRead = async () => {
    throw new Error('Synthetic read failure');
  };
  if (failed === 'encounters') readEncounters = rejectRead;
  else readControlNumbers = rejectRead;
  renderSelector();

  const retry = await screen.findByRole('button', { name: 'Reintentar' });
  expect(screen.queryByRole('table', { name: 'forms' })).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic read failure')).not.toBeInTheDocument();
  expect(launchWorkspace2).not.toHaveBeenCalled();
  readEncounters = async () => response(encounters);
  readControlNumbers = async () => response(controlNumbers);
  await userEvent.click(retry);
  await openForm();
  await waitFor(() =>
    expect(launchWorkspace2).toHaveBeenCalledWith(
      formEntryWorkspace,
      expect.objectContaining({ encounterUuid: 'control-one' }),
    ),
  );
});

it('reopens the selected historical control instead of the most recent control', async () => {
  renderSelector();
  await openForm();
  await waitFor(() =>
    expect(launchWorkspace2).toHaveBeenCalledWith(
      formEntryWorkspace,
      expect.objectContaining({
        encounterUuid: 'control-one',
        preFilledQuestions: { encounterDatetime: new Date('2026-06-01T10:00:00Z') },
      }),
    ),
  );
  expect(encounters[1].uuid).toBe('control-two');
  expect(controlNumbers.map((observation) => observation.value)).toEqual([1, 2]);
});

it('creates only after an empty read, then reopens the saved encounter before and after reload', async () => {
  readEncounters = async () => response([]);
  readControlNumbers = async () => response([]);
  const view = renderSelector();
  await openForm();
  await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledOnce());
  const opened = vi.mocked(launchWorkspace2).mock.calls[0][1] as {
    encounterUuid: string;
    handlePostResponse: (encounter: { uuid: string }) => void;
    handleEncounterCreate: (encounter: { obs: unknown[] }) => { obs: unknown[] };
  };
  expect(opened.encounterUuid).toBe('');
  expect(opened.handleEncounterCreate({ obs: [] }).obs).toEqual([{ concept: 'synthetic-control-number', value: 1 }]);
  await act(async () => opened.handlePostResponse({ uuid: 'saved-control-one' }));
  await userEvent.click(screen.getByText(form.display));
  await waitFor(() =>
    expect(launchWorkspace2).toHaveBeenLastCalledWith(
      formEntryWorkspace,
      expect.objectContaining({ encounterUuid: 'saved-control-one' }),
    ),
  );

  view.unmount();
  readEncounters = async () => response([{ ...encounters[0], uuid: 'saved-control-one' }]);
  readControlNumbers = async () =>
    response([{ uuid: 'saved-control-number', value: 1, encounter: { uuid: 'saved-control-one' } }]);
  vi.mocked(launchWorkspace2).mockClear();
  renderSelector();
  await openForm();
  await waitFor(() =>
    expect(launchWorkspace2).toHaveBeenCalledWith(
      formEntryWorkspace,
      expect.objectContaining({ encounterUuid: 'saved-control-one' }),
    ),
  );
});

it('does not offer forms when the user lacks the required edit privilege', async () => {
  vi.mocked(userHasAccess).mockReturnValue(false);
  renderSelector();
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
  expect(screen.queryByText(form.display)).not.toBeInTheDocument();
  expect(launchWorkspace2).not.toHaveBeenCalled();
});

it('preserves the saved-form state across a failed refresh and retry', async () => {
  renderSelector();
  await openForm();
  await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledOnce());
  const opened = vi.mocked(launchWorkspace2).mock.calls[0][1] as {
    handlePostResponse: (encounter: { uuid: string }) => void;
  };
  readControlNumbers = async () => {
    throw new Error('Synthetic refresh failure');
  };
  await act(async () => opened.handlePostResponse({ uuid: 'control-one' }));
  const retry = await screen.findByRole('button', { name: 'Reintentar' });
  expect(screen.queryByRole('button', { name: 'Guardar y Firmar' })).not.toBeInTheDocument();

  readControlNumbers = async () => response(controlNumbers);
  await userEvent.click(retry);
  expect(await screen.findByRole('button', { name: 'Guardar y Firmar' })).toBeEnabled();
  expect(screen.getByText('Formularios completados: 1')).toBeVisible();
});
