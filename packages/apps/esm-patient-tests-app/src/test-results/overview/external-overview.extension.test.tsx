import { omrsOfflineCachingStrategyHttpHeaderName, navigate, useConnectivity } from '@openmrs/esm-framework';
import { type ExternalOverviewProps } from '@openmrs/esm-patient-common-lib';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useTranslation } from 'react-i18next';

import es from '../../../translations/es.json';
import { loadObsEntries } from '../loadPatientTestData/helpers';
import ExternalOverview from './external-overview.extension';
import { Overview } from './overview.component';
import RecentOverview from './recent-overview.component';

// The shared Vitest configuration erases SCSS exports. Keep real selector names
// so the normal/high control also verifies the interpretation-to-cell mapping.
vi.mock('./common-datatable.scss', () => ({
  default: {
    tableContainer: 'tableContainer',
    desktop: 'desktop',
    tablet: 'tablet',
    high: 'high',
    low: 'low',
    criticallyHigh: 'criticallyHigh',
    criticallyLow: 'criticallyLow',
    offScaleHigh: 'offScaleHigh',
    offScaleLow: 'offScaleLow',
  },
}));

const allowAll: ExternalOverviewProps['filter'] = () => true;
let translation: ReturnType<typeof useTranslation>;
let originalTranslation: typeof translation.t;
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const bundle = (observations: fhir.Observation[], total: number | undefined = observations.length) => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total,
  entry: observations.map((resource) => ({ resource })),
});

function setupApi() {
  const concepts = new Map([
    [
      'synthetic-test',
      {
        uuid: 'synthetic-test',
        display: 'Synthetic test',
        conceptClass: { name: 'Test', display: 'Test' },
        datatype: { display: 'Numeric' },
        units: 'U/L',
        lowNormal: 0,
        hiNormal: 100,
      },
    ],
  ]);
  const observations: fhir.Observation[] = [
    {
      resourceType: 'Observation',
      id: 'synthetic-observation',
      status: 'final',
      code: { coding: [{ code: 'synthetic-test', display: 'Synthetic test' }] },
      subject: { reference: 'Patient/synthetic-patient' },
      effectiveDateTime: '2026-09-08T10:00:00Z',
      issued: '2026-09-08T11:00:00Z',
      valueQuantity: { value: 50, unit: 'U/L' },
    },
  ];
  const state = { observations, observationStatus: 200, conceptStatus: 200 };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = new URL(String(input), 'https://synthetic.invalid');
    if (url.pathname.endsWith('/Observation')) {
      if (state.observationStatus !== 200)
        return jsonResponse({ error: 'Synthetic private diagnostic' }, state.observationStatus);
      const offset = Number(url.searchParams.get('_getpagesoffset') ?? 0);
      return jsonResponse(bundle(state.observations.slice(offset, offset + 300), state.observations.length));
    }
    const concept = concepts.get(url.pathname.split('/concept/')[1]);
    if (!concept) throw new Error('Unexpected synthetic request');
    return jsonResponse(
      state.conceptStatus === 200 ? concept : { error: 'Synthetic private diagnostic' },
      state.conceptStatus,
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return { state, concepts, fetchMock };
}

const card = (patientUuid = 'synthetic-patient', filter = allowAll): React.ReactElement => (
  <ExternalOverview patientUuid={patientUuid} filter={filter} />
);
const numericCell = (value: number) => screen.findByRole('cell', { name: new RegExp(`^${value}(?: U/L)?$`) });

beforeEach(() => {
  vi.mocked(useConnectivity).mockReturnValue(true);
  translation = renderHook(() => useTranslation()).result.current;
  originalTranslation = translation.t;
});

afterEach(() => {
  cleanup();
  translation.t = originalTranslation;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('recent laboratory results', () => {
  it('shows an empty state only after a successful empty history', async () => {
    const { state, fetchMock } = setupApi();
    state.observations = [];
    render(card());
    expect(screen.queryByText(/There are no/)).toBeNull();
    expect(await screen.findByText(/There are no/)).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, undefined],
    [150, 'high'],
    [-5, 'low'],
  ] as const)('preserves %i and its interpretation', async (value, cssClass) => {
    const { state } = setupApi();
    state.observations[0].valueQuantity.value = value;
    render(card());
    const cell = await numericCell(value);
    expect(cell).toHaveTextContent(`${value} U/L`);
    if (cssClass) expect(cell).toHaveClass(cssClass);
    else expect(cell).not.toHaveClass('high', 'low');
  });

  it('assesses the observation-specific range that is actually displayed', async () => {
    const { state } = setupApi();
    state.observations[0].referenceRange = [
      {
        low: { value: 0 },
        high: { value: 10 },
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/referencerange-meaning',
              code: 'normal',
            },
          ],
        },
      },
    ];
    render(card());
    const cell = await numericCell(50);
    expect(cell).toHaveClass('high');
    expect(screen.getByRole('cell', { name: '0 – 10 U/L' })).toBeVisible();
  });

  it('uses catalog units when missing from a quantity and does not duplicate units in range text', async () => {
    const { state } = setupApi();
    state.observations[0].valueQuantity = { value: 50 };
    state.observations[0].referenceRange = [{ text: '0 – 10 U/L' }];
    render(card());
    const cell = await numericCell(50);
    expect(cell).toHaveTextContent('50 U/L');
    expect(cell).toHaveClass('high');
    expect(screen.getByRole('cell', { name: '0 – 10 U/L' })).toBeVisible();
  });

  it('preserves grouped panel members and their numeric interpretation', async () => {
    const { state, concepts } = setupApi();
    concepts.set('synthetic-panel', {
      ...concepts.get('synthetic-test'),
      uuid: 'synthetic-panel',
      display: 'Synthetic panel',
      conceptClass: { name: 'LabSet', display: 'LabSet' },
    });
    state.observations[0].valueQuantity.value = 150;
    const panel: fhir.Observation = {
      ...state.observations[0],
      id: 'synthetic-panel-observation',
      code: { coding: [{ code: 'synthetic-panel' }] },
      hasMember: [{ reference: 'Observation/synthetic-observation' }],
    };
    delete panel.valueQuantity;
    state.observations.unshift(panel);
    render(card());
    expect(await screen.findByRole('heading', { name: 'Synthetic panel' })).toBeVisible();
    const cells = await screen.findAllByRole('cell', { name: '150 U/L' });
    expect(cells).toHaveLength(2);
    cells.forEach((cell) => {
      expect(cell).toHaveClass('high');
    });
  });

  it.each([
    ['HH', 'criticallyHigh'],
    ['LL', 'criticallyLow'],
  ])('prefers the server interpretation %s', async (code, cssClass) => {
    const { state } = setupApi();
    state.observations[0].interpretation = [{ coding: [{ code }] }];
    render(card());
    expect(await numericCell(50)).toHaveClass(cssClass);
  });

  it('clears patient A before loading patient B and aborts the superseded request', async () => {
    const { fetchMock } = setupApi();
    const view = render(card('synthetic-a'));
    await numericCell(50);
    const signals = fetchMock.mock.calls.map((call) => (call[1] as RequestInit | undefined)?.signal).filter(Boolean);
    fetchMock.mockImplementation(async () => new Promise<Response>(() => {}));
    view.rerender(card('synthetic-b'));
    expect(screen.queryByRole('cell', { name: /50/ })).toBeNull();
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('does not let a late response restore results from the previous patient', async () => {
    const { state, fetchMock } = setupApi();
    let release: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const view = render(card('synthetic-a'));
    view.rerender(card('synthetic-b'));
    await numericCell(50);
    const old = {
      ...state.observations[0],
      valueQuantity: { value: 13, unit: 'U/L' },
    };
    await act(async () => {
      release(jsonResponse(bundle([old])));
    });
    expect(screen.queryByRole('cell', { name: /13/ })).toBeNull();
    expect(await numericCell(50)).toBeVisible();
  });

  it('reloads corrected values with the same UUID on reopening and explicit refresh', async () => {
    const { state } = setupApi();
    const view = render(card());
    await numericCell(50);
    view.unmount();
    state.observations[0] = {
      ...state.observations[0],
      status: 'corrected',
      issued: '2026-09-08T12:00:00Z',
      valueQuantity: { value: 80, unit: 'U/L' },
    };
    render(card());
    await numericCell(80);
    state.observations[0].valueQuantity.value = 90;
    await userEvent.click(screen.getByRole('button', { name: 'Refresh data' }));
    await numericCell(90);
    expect(screen.queryByRole('cell', { name: '80 U/L' })).toBeNull();
  });

  it.each([401, 403, 503])('shows a safe error and retry for HTTP %i', async (status) => {
    const { state } = setupApi();
    state.observationStatus = status;
    render(card());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Test results could not be loaded. Try again.');
    expect(document.body).not.toHaveTextContent('Synthetic private diagnostic');
    expect(screen.queryByText(/There are no/)).toBeNull();
    state.observationStatus = 200;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await numericCell(50);
  });

  it.each(['network', 'json', 'bundle'])('recovers from a %s failure without showing raw errors', async (failure) => {
    const { fetchMock } = setupApi();
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new Error('Synthetic private diagnostic'));
    else if (failure === 'json') fetchMock.mockResolvedValueOnce(new Response('<private-error>'));
    else fetchMock.mockResolvedValueOnce(jsonResponse({ resourceType: 'OperationOutcome' }));
    render(card());
    await screen.findByRole('alert');
    expect(document.body).not.toHaveTextContent('private');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await numericCell(50);
  });

  it('retries concept metadata after a transient failure', async () => {
    const { state, fetchMock } = setupApi();
    state.conceptStatus = 503;
    render(card());
    await screen.findByRole('alert');
    state.conceptStatus = 200;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await numericCell(50);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/concept/'))).toHaveLength(2);
  });

  it.each(['string', 'codedText', 'codedDisplay'])('preserves a %s result', async (kind) => {
    const { state, concepts } = setupApi();
    const observation = state.observations[0];
    delete observation.valueQuantity;
    const concept = concepts.get('synthetic-test');
    concept.units = undefined;
    concept.datatype.display = kind === 'string' ? 'Text' : 'Coded';
    if (kind === 'string') observation.valueString = 'Synthetic negative';
    else
      observation.valueCodeableConcept =
        kind === 'codedText'
          ? { text: 'Synthetic negative' }
          : {
              coding: [{ code: 'synthetic-negative', display: 'Synthetic negative' }],
            };
    render(card());
    expect(await screen.findByRole('cell', { name: 'Synthetic negative' })).toBeVisible();
  });

  it('retains a quantity comparator and avoids interpreting its bound as an exact value', async () => {
    const { state } = setupApi();
    state.observations[0].valueQuantity = {
      value: 150,
      comparator: '<',
      unit: 'U/L',
    };
    render(card());
    const cell = await screen.findByRole('cell', { name: '< 150 U/L' });
    expect(cell).not.toHaveClass('high');
  });

  it('keeps distinct concept UUIDs sharing a label and the supplied panel filter', async () => {
    const { state, concepts } = setupApi();
    concepts.set('synthetic-other', {
      ...concepts.get('synthetic-test'),
      uuid: 'synthetic-other',
    });
    state.observations.push({
      ...state.observations[0],
      id: 'synthetic-other-observation',
      code: { coding: [{ code: 'synthetic-other' }] },
      valueQuantity: { value: 31, unit: 'U/L' },
    });
    const view = render(card());
    await numericCell(50);
    await numericCell(31);
    const filter = vi.fn<ExternalOverviewProps['filter']>(([, uuid]) => uuid === 'synthetic-other');
    view.rerender(card('synthetic-patient', filter));
    expect(screen.queryByRole('cell', { name: '50 U/L' })).toBeNull();
    expect(await numericCell(31)).toBeVisible();
    expect(filter.mock.calls.map(([panel]) => panel)).toContainEqual([
      expect.objectContaining({ id: 'synthetic-other-observation' }),
      'synthetic-other',
      'Test',
      'Synthetic test',
    ]);
  });

  it('shows Spanish headers, actions, and feedback', async () => {
    translation.t = ((key: string, fallback: string) => es[key] ?? fallback ?? key) as typeof originalTranslation;
    setupApi();
    render(card());
    await numericCell(50);
    expect(screen.getByRole('columnheader', { name: /Nombre de la prueba/ })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: /Rango de referencia/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Actualizar datos' })).toBeVisible();
  });

  it('loads after reconnection, hides offline results, and keeps current-patient navigation', async () => {
    const { fetchMock } = setupApi();
    vi.mocked(useConnectivity).mockReturnValue(false);
    const view = render(card('synthetic-b'));
    expect(screen.getByRole('alert')).toHaveTextContent('Connect to the network');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.mocked(useConnectivity).mockReturnValue(true);
    view.rerender(card('synthetic-b'));
    await numericCell(50);
    await userEvent.click(screen.getByRole('button', { name: /^See all results/ }));
    expect(navigate).toHaveBeenCalledWith({
      to: `\${openmrsSpaBase}/patient/synthetic-b/chart/Results`,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
        }),
      }),
    );
    vi.mocked(useConnectivity).mockReturnValue(false);
    view.rerender(card('synthetic-b'));
    expect(screen.queryByRole('cell', { name: /50/ })).toBeNull();
  });

  it.each(['overview', 'recent'])('preserves error handling in the %s consumer', async (consumer) => {
    const { state } = setupApi();
    state.observationStatus = 503;
    render(
      consumer === 'overview' ? (
        <Overview patientUuid="synthetic-patient" />
      ) : (
        <RecentOverview patientUuid="synthetic-patient" basePath="/patient/synthetic-patient" />
      ),
    );
    await screen.findByRole('alert');
    expect(screen.queryByText(/There are no/)).toBeNull();
  });
});

describe('complete observation pagination', () => {
  it('loads all 301 results using the offset fallback', async () => {
    const { state, fetchMock } = setupApi();
    state.observations = Array.from({ length: 301 }, (_, i) => ({
      ...state.observations[0],
      id: `synthetic-${i}`,
    }));
    expect(await loadObsEntries('synthetic-patient')).toHaveLength(301);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('follows next links without a total and retains the configured SPA origin', async () => {
    const { state, fetchMock } = setupApi();
    const first = state.observations[0];
    const second = { ...first, id: 'synthetic-second' };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...bundle([first]),
        total: undefined,
        link: [
          {
            relation: 'next',
            url: 'https://synthetic-backend.invalid/openmrs/ws/fhir2/R4/Observation?_getpages=synthetic-cursor&_getpagesoffset=1',
          },
        ],
      }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...bundle([second]), total: undefined }));
    expect((await loadObsEntries('synthetic-patient')).map((obs) => obs.id)).toEqual([first.id, second.id]);
    const nextUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(nextUrl.origin).toBe(window.location.origin);
    expect(nextUrl.searchParams.get('_getpages')).toBe('synthetic-cursor');
  });

  it('retains a nonempty final bundle without a total', async () => {
    const { state, fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...bundle(state.observations), total: undefined }));
    expect(await loadObsEntries('synthetic-patient')).toHaveLength(1);
  });

  it('rejects a failed second page instead of returning partial results', async () => {
    const { state, fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(jsonResponse(bundle(state.observations, 2)));
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Synthetic error' }, 503));
    await expect(loadObsEntries('synthetic-patient')).rejects.toThrow();
  });

  it('rejects a repeated final page instead of silently losing a result during deduplication', async () => {
    const { state, fetchMock } = setupApi();
    fetchMock.mockImplementation(async () => jsonResponse(bundle(state.observations, 2)));
    await expect(loadObsEntries('synthetic-patient')).rejects.toThrow();
  });

  it('rejects a repeated page and pagination links for a different patient', async () => {
    const { state, fetchMock } = setupApi();
    // Return a fresh Response because each body is consumed exactly once.
    fetchMock.mockImplementation(async () => jsonResponse(bundle(state.observations, 3)));
    await expect(loadObsEntries('synthetic-patient')).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...bundle(state.observations),
        link: [
          {
            relation: 'next',
            url: '/openmrs/ws/fhir2/R4/Observation?patient=synthetic-other',
          },
        ],
      }),
    );
    await expect(loadObsEntries('synthetic-patient')).rejects.toThrow();
  });
});
