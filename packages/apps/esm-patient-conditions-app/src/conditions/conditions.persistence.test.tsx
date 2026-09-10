import {
  type FetchResponse,
  openmrsFetch,
  showSnackbar,
  useLayoutType,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import {
  mapConditionProperties,
  type OpenmrsCondition,
  type PatientWorkspace2DefinitionProps,
} from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import ConditionsDetailedSummary from './conditions-detailed-summary.component';
import ConditionsForm, { type ConditionFormProps } from './conditions-form.workspace';

// Resource adapters, the shared mapper/transport and SWR remain real. Only the
// framework boundary supplies the synthetic session, patient and HTTP responses.
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework')),
  makeUrl: (path: string) => (path.startsWith('http') ? path : `${window.openmrsBase}${path}`),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-strategy',
  useLayoutType: vi.fn(),
  useSession: vi.fn(),
  userHasAccess: vi.fn(),
}));

const patient: fhir.Patient = { resourceType: 'Patient', id: 'synthetic-contract-patient', birthDate: '1990-01-01' };
function originalCondition(): OpenmrsCondition {
  return {
    uuid: 'synthetic-original-condition',
    patient: { uuid: patient.id },
    condition: { coded: { uuid: 'synthetic-surgical-concept', display: 'Synthetic previous surgery' } },
    clinicalStatus: 'ACTIVE',
    verificationStatus: 'CONFIRMED',
    additionalDetail: 'Synthetic clinical detail\n__sihsalus_antecedent_type:surgical',
    onsetDate: '2021-05-04T09:30:00-05:00',
    endDate: null,
    previousVersion: null,
    voided: false,
    auditInfo: { dateCreated: '2021-05-05T11:15:00-05:00', creator: { uuid: 'synthetic-original-author' } },
  };
}

type Request = { path: string; method: string; body?: Record<string, unknown> };

function installBackend(initial: Array<OpenmrsCondition> = [], creationFailure?: 'refresh' | 'acknowledgement') {
  let current = structuredClone(initial);
  const previousVersions: Array<OpenmrsCondition> = [];
  const requests: Array<Request> = [];
  let created = false;

  vi.mocked(openmrsFetch).mockImplementation(async (url, options) => {
    const parsedUrl = new URL(String(url), window.location.href);
    const path = parsedUrl.pathname;
    const method = options?.method ?? 'GET';
    const body = options?.body as Record<string, unknown> | undefined;
    requests.push({ path, method, body });

    if (method === 'GET' && path.endsWith('/condition')) {
      expect(parsedUrl.searchParams.get('patientUuid')).toBe(patient.id);
      expect(parsedUrl.searchParams.get('includeInactive')).toBe('true');
      expect(parsedUrl.searchParams.get('v')).toBe('full');
      if (created && creationFailure === 'refresh') throw new Error('Synthetic collection unavailable');
      return { data: { totalCount: current.length, results: structuredClone(current) } } as FetchResponse;
    }
    if (method === 'GET' && path.includes('/condition/')) {
      const condition = [...current, ...previousVersions].find(({ uuid }) => path.endsWith(`/${uuid}`));
      if (!condition) throw new Error('Synthetic condition not found');
      expect(parsedUrl.searchParams.get('v')).toBe('full');
      return { data: structuredClone(condition) } as FetchResponse;
    }
    if (method === 'POST' && path.endsWith('/condition')) {
      const incoming = body as unknown as {
        patient: string;
        condition: { nonCoded: string };
        clinicalStatus: string;
        verificationStatus?: string;
        onsetDate?: string;
        endDate?: string;
        additionalDetail?: string;
      };
      const persisted: OpenmrsCondition = {
        ...structuredClone(incoming),
        uuid: 'synthetic-created-condition',
        patient: { uuid: incoming.patient },
        verificationStatus: incoming.verificationStatus ?? null,
        voided: false,
        auditInfo: { dateCreated: '2026-01-02T10:00:00Z', creator: { uuid: 'synthetic-editor' } },
      };
      current.push(persisted);
      created = true;
      if (creationFailure === 'acknowledgement') throw new TypeError('Synthetic response lost after commit');
      return { status: 201, data: structuredClone(persisted) } as FetchResponse;
    }
    if (method === 'POST' && path.includes('/condition/')) {
      const original = current.find(({ uuid }) => path.endsWith(`/${uuid}`));
      if (!original || !body) throw new Error('Synthetic correction target missing');
      previousVersions.push({
        ...structuredClone(original),
        voided: true,
        auditInfo: {
          ...original.auditInfo,
          voidedBy: { uuid: 'synthetic-editor' },
          dateVoided: '2026-01-03T10:00:00Z',
          voidReason: 'Condition replaced by synthetic-corrected-condition',
        },
      });
      const corrected: OpenmrsCondition = {
        ...structuredClone(original),
        uuid: 'synthetic-corrected-condition',
        previousVersion: { uuid: original.uuid },
        auditInfo: { dateCreated: '2026-01-03T10:00:00Z', creator: { uuid: 'synthetic-editor' } },
      };
      if (body.clinicalStatus) corrected.clinicalStatus = String(body.clinicalStatus);
      if ('onsetDate' in body) corrected.onsetDate = body.onsetDate as string;
      if ('endDate' in body) corrected.endDate = body.endDate as string;
      if ('additionalDetail' in body) corrected.additionalDetail = body.additionalDetail as string;
      current = current.map((condition) => (condition.uuid === original.uuid ? corrected : condition));
      return { status: 200, data: structuredClone(corrected) } as FetchResponse;
    }
    throw new Error(`Unexpected synthetic HTTP route: ${method} ${path}`);
  });

  return { requests, previousVersions, records: () => structuredClone(current) };
}

function renderHistory(workspaceProps: ConditionFormProps = { formContext: 'creating' }) {
  const readErrors: Array<unknown> = [];
  const props: PatientWorkspace2DefinitionProps<ConditionFormProps, object> = {
    closeWorkspace: vi.fn(),
    groupProps: { patientUuid: patient.id, patient, visitContext: null, mutateVisitContext: null },
    workspaceName: '',
    launchChildWorkspace: vi.fn(),
    workspaceProps,
    windowProps: {},
    windowName: '',
    isRootWorkspace: false,
    showActionMenu: true,
  };
  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        onError: (error) => readErrors.push(error),
      }}
    >
      <ConditionsForm {...props} />
      <ConditionsDetailedSummary patient={patient} />
    </SWRConfig>,
  );
  return { ...props, readErrors };
}

beforeEach(() => {
  vi.mocked(useLayoutType).mockReturnValue('small-desktop');
  vi.mocked(useSession).mockReturnValue({
    user: { uuid: 'synthetic-editor', privileges: [{ name: 'Get Conditions' }, { name: 'Edit Conditions' }] },
    currentProvider: { uuid: 'synthetic-provider' },
  } as never);
  vi.mocked(userHasAccess).mockReturnValue(true);
  vi.mocked(usePatient).mockReturnValue({ patient, patientUuid: patient.id, isLoading: false, error: null });
});

async function fillNarrative() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('radio', { name: /surgical|quirúrgico/i }));
  await user.type(screen.getByRole('textbox', { name: /non-coded antecedent/i }), 'Synthetic uncoded surgery');
  await user.click(screen.getByRole('radio', { name: 'Active' }));
  return user;
}

it('persists native narrative text and its surgical classification through real resources and a full reload', async () => {
  const backend = installBackend();
  const props = renderHistory();
  const user = await fillNarrative();

  await user.click(screen.getByRole('button', { name: /save.*close/i }));

  await waitFor(() => expect(props.closeWorkspace).toHaveBeenCalledOnce());
  expect(props.readErrors).toEqual([]);
  expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  const table = await screen.findByRole('table', { name: 'Antecedents summary' });
  expect(within(table).getByText('Synthetic uncoded surgery')).toBeInTheDocument();
  expect(
    within(screen.getByRole('table', { name: 'Active problems summary' })).queryByText('Synthetic uncoded surgery'),
  ).not.toBeInTheDocument();
  const writes = backend.requests.filter(({ method }) => method === 'POST');
  expect(writes).toHaveLength(1);
  expect(writes[0].body?.condition).toEqual({ nonCoded: 'Synthetic uncoded surgery' });
  expect(writes[0].body?.patient).toBe(patient.id);
  expect(writes[0].body?.auditInfo).toBeUndefined();
  expect(writes[0].body?.verificationStatus).toBeUndefined();
  expect(backend.records()[0].additionalDetail).toContain('__sihsalus_antecedent_type:surgical');
  expect(props.closeWorkspace).toHaveBeenCalledOnce();
});

it('corrects through REST and reloads the replacement UUID without overwriting the original audit or clinical detail', async () => {
  const original = originalCondition();
  const backend = installBackend([original]);
  const props = renderHistory({ formContext: 'editing', condition: mapConditionProperties(original) });
  const user = userEvent.setup();

  await user.click(await screen.findByRole('radio', { name: 'Inactive' }));
  await user.click(screen.getByRole('button', { name: /save.*close/i }));

  await waitFor(() => expect(props.closeWorkspace).toHaveBeenCalledOnce());
  const writes = backend.requests.filter(({ method }) => method !== 'GET');
  expect(writes).toEqual([
    expect.objectContaining({
      method: 'POST',
      path: expect.stringMatching(/\/condition\/synthetic-original-condition$/),
      body: { clinicalStatus: 'INACTIVE' },
    }),
  ]);
  expect(backend.previousVersions).toEqual([
    expect.objectContaining({ ...original, voided: true, auditInfo: expect.objectContaining(original.auditInfo) }),
  ]);
  expect(backend.records()).toEqual([
    expect.objectContaining({
      uuid: 'synthetic-corrected-condition',
      condition: original.condition,
      additionalDetail: original.additionalDetail,
      onsetDate: original.onsetDate,
      previousVersion: { uuid: original.uuid },
      auditInfo: { creator: { uuid: 'synthetic-editor' }, dateCreated: '2026-01-03T10:00:00Z' },
    }),
  ]);
  const table = screen.getByRole('table', { name: 'Antecedents summary' });
  expect(within(table).getByText('Inactive')).toBeInTheDocument();
  expect(within(table).getAllByText('Synthetic previous surgery')).toHaveLength(1);
  expect(
    backend.requests.some(
      ({ path, method }) => method === 'GET' && path.endsWith('/condition/synthetic-original-condition'),
    ),
  ).toBe(true);
});

it('warns after a confirmed creation whose reload fails and prevents a second write', async () => {
  const backend = installBackend([], 'refresh');
  const props = renderHistory();
  const user = await fillNarrative();

  await user.click(screen.getByRole('button', { name: /save.*close/i }));

  await waitFor(() => expect(props.closeWorkspace).toHaveBeenCalledOnce());
  expect(showSnackbar).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'warning', subtitle: 'Saved. Reload the history to see the latest information.' }),
  );
  await user.click(screen.getByRole('button', { name: 'Antecedent saved' }));
  expect(backend.requests.filter(({ method }) => method === 'POST')).toHaveLength(1);
  expect(backend.records()).toHaveLength(1);
});

it('keeps recurrence, relapse, remission and resolution distinct after reading the REST history', async () => {
  const conditions = ['RECURRENCE', 'RELAPSE', 'REMISSION', 'RESOLVED'].map((clinicalStatus) => ({
    ...originalCondition(),
    uuid: `synthetic-${clinicalStatus.toLowerCase()}`,
    condition: { nonCoded: `Synthetic ${clinicalStatus.toLowerCase()}` },
    clinicalStatus,
    additionalDetail: '__sihsalus_antecedent_type:pathological',
  }));
  installBackend(conditions);
  const props = renderHistory();

  const active = await screen.findByRole('table', { name: 'Active problems summary' });
  const history = screen.getByRole('table', { name: 'Antecedents summary' });
  expect(props.readErrors).toEqual([]);
  for (const status of ['Recurrence', 'Relapse']) {
    expect(within(active).getByText(status)).toBeInTheDocument();
    expect(within(history).queryByText(status)).not.toBeInTheDocument();
  }
  for (const status of ['Remission', 'Resolved']) {
    expect(within(history).getByText(status)).toBeInTheDocument();
    expect(within(active).queryByText(status)).not.toBeInTheDocument();
  }
});

it('prevents a duplicate after the server commits creation but its acknowledgement is lost', async () => {
  const backend = installBackend([], 'acknowledgement');
  const props = renderHistory();
  const user = await fillNarrative();
  const save = screen.getByRole('button', { name: /save.*close/i });

  await user.click(save);

  await waitFor(() =>
    expect(screen.getAllByRole('alert').some((alert) => /confirm/i.test(alert.textContent))).toBe(true),
  );
  expect(save).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Antecedent saved' })).not.toBeInTheDocument();
  expect(showSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  expect(props.closeWorkspace).not.toHaveBeenCalled();
  await user.click(save);
  expect(backend.requests.filter(({ method }) => method === 'POST')).toHaveLength(1);
  expect(backend.records()).toHaveLength(1);
  const cancel = screen.getByRole('button', { name: 'Cancel' });
  expect(cancel).toBeEnabled();
  await user.click(cancel);
  expect(props.closeWorkspace).toHaveBeenCalledOnce();
});
