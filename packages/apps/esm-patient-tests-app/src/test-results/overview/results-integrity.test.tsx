import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import loadPatientData from '../loadPatientTestData/loadPatientData';
import { loadObsEntries } from '../loadPatientTestData/helpers';
import CommonDataTable from './common-datatable.component';
import ExternalOverview from './external-overview.extension';
import { parseSingleEntry, type OverviewPanelData } from './useOverviewData';

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

const observation = (id = 'synthetic-obs', concept = 'synthetic-concept'): fhir.Observation => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { coding: [{ code: concept }] },
  subject: { reference: 'Patient/synthetic-patient' },
  effectiveDateTime: '2026-09-08T10:00:00Z',
  valueQuantity: { value: 50, unit: 'U/L' },
});
const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const bundle = (entries: fhir.Observation[], total?: number, next?: string) => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total,
  entry: entries.map((resource) => ({ resource })),
  ...(next ? { link: [{ relation: 'next', url: next }] } : {}),
});
const normalType = {
  coding: [{ system: 'http://terminology.hl7.org/CodeSystem/referencerange-meaning', code: 'normal' }],
};

function setupApi() {
  const state = { entries: [observation()] };
  const concepts = new Map([
    [
      'synthetic-concept',
      {
        uuid: 'synthetic-concept',
        display: 'Synthetic test',
        conceptClass: { name: 'Test', display: 'Test' },
        datatype: { display: 'Numeric' },
        units: 'U/L',
        lowNormal: 0,
        hiNormal: 100,
      },
    ],
  ]);
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), window.location.href);
    if (url.pathname.endsWith('/Observation')) return response(bundle(state.entries, state.entries.length));
    const concept = concepts.get(url.pathname.split('/concept/')[1]);
    if (!concept) throw new Error('Unexpected synthetic concept');
    return response(concept);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { state, concepts, fetchMock };
}
async function loadSingle() {
  const data = await loadPatientData('synthetic-patient');
  return data['synthetic-concept'].entries[0];
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('observation-specific ranges and units', () => {
  it('honors an explicitly typed two-sided normal range', async () => {
    const { state } = setupApi();
    state.entries[0].referenceRange = [{ low: { value: 0 }, high: { value: 10 }, type: normalType }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe('0 – 10 U/L');
    expect(row.interpretation).toBe('HIGH');
  });

  it('honors a normal reference range when its optional type is absent', async () => {
    const { state } = setupApi();
    state.entries[0].referenceRange = [{ low: { value: 0 }, high: { value: 10 } }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect({ range: row.range, interpretation: row.interpretation }).toEqual({
      range: '0 – 10 U/L',
      interpretation: 'HIGH',
    });
  });

  it('does not display the catalog range when the observation supplies only an upper bound', async () => {
    const { state } = setupApi();
    state.entries[0].referenceRange = [{ high: { value: 10 }, type: normalType }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.interpretation).toBe('HIGH');
    expect(row.range).toBe('≤ 10 U/L');
  });

  it('preserves units when result and catalog agree', async () => {
    setupApi();
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.value.value).toBe('50 U/L');
    expect(row.range).toBe('0 – 100 U/L');
    expect(row.interpretation).toBe('NORMAL');
  });

  it('does not relabel an unconverted catalog range with different result units', async () => {
    const { state, concepts } = setupApi();
    concepts.get('synthetic-concept').units = 'mg/dL';
    state.entries[0].valueQuantity = { value: 50, unit: 'mmol/L' };
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.value.value).toBe('50 mmol/L');
    expect(row.range).toBe('0 – 100 mg/dL');
    expect(row.interpretation).toBe('--');
  });
});

const headers = [
  { key: 'name', header: 'Test name' },
  { key: 'value', header: 'Value' },
  { key: 'range', header: 'Reference range' },
];
const tableRows: OverviewPanelData[] = [
  {
    id: 'synthetic-high',
    name: 'Zeta high',
    range: '0 – 100 U/L',
    interpretation: 'HIGH',
    value: { value: '150 U/L', interpretation: 'HIGH' },
  },
  {
    id: 'synthetic-normal',
    name: 'Alpha normal',
    range: '0 – 100 U/L',
    interpretation: 'NORMAL',
    value: { value: '50 U/L', interpretation: 'NORMAL' },
  },
];
const table = (): React.ReactElement => <CommonDataTable data={tableRows} tableHeaders={headers} />;
const bodyRows = () => screen.getAllByRole('row').slice(1);
const sortBy = async (name: string) => {
  await userEvent.click(within(screen.getByRole('columnheader', { name: new RegExp(name) })).getByRole('button'));
};

describe('rendered panel sorting', () => {
  it('sorts by test name', async () => {
    render(table());
    expect(bodyRows()[0]).toHaveTextContent('Zeta high');
    await sortBy('Test name');
    expect(bodyRows()[0]).toHaveTextContent('Alpha normal');
  });

  it('retains the interpretation of each row after sorting by name', async () => {
    render(table());
    const normalRow = screen.getByRole('cell', { name: 'Alpha normal' }).closest('tr');
    expect(normalRow).not.toHaveClass('high');
    await sortBy('Test name');
    expect(screen.getByRole('cell', { name: 'Alpha normal' }).closest('tr')).not.toHaveClass('high');
    expect(screen.getByRole('cell', { name: 'Zeta high' }).closest('tr')).toHaveClass('high');
  });

  it('sorts numeric values rather than treating every wrapped value as identical', async () => {
    render(table());
    await sortBy('Value');
    expect(within(bodyRows()[0]).getAllByRole('cell')[1]).toHaveTextContent(/^50 U\/L$/);
    await sortBy('Value');
    expect(within(bodyRows()[0]).getAllByRole('cell')[1]).toHaveTextContent(/^150 U\/L$/);
  });
});

describe('pagination and panel membership', () => {
  it('follows a next link using the Observation resource path', async () => {
    const { fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(
      response(
        bundle(
          [observation('synthetic-one')],
          2,
          '/openmrs/ws/fhir2/R4/Observation?_getpages=synthetic-cursor&_getpagesoffset=1',
        ),
      ),
    );
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-two')], 2)));
    expect(await loadObsEntries('synthetic-patient')).toHaveLength(2);
  });

  it('follows the server next link when a paging cursor is rooted at the FHIR base', async () => {
    const { fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(
      response(
        bundle([observation('synthetic-one')], 2, '/openmrs/ws/fhir2/R4?_getpages=synthetic-cursor&_getpagesoffset=1'),
      ),
    );
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-two')], 2)));
    await expect(loadObsEntries('synthetic-patient')).resolves.toHaveLength(2);
  });

  it('rejects overlapping pages that cannot satisfy the advertised unique total', async () => {
    const { fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-a'), observation('synthetic-b')], 4)));
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-b'), observation('synthetic-c')], 4)));
    await expect(loadObsEntries('synthetic-patient')).rejects.toThrow();
  });

  it('retains a member belonging to one panel', async () => {
    const { state, concepts } = setupApi();
    concepts.set('synthetic-panel', {
      ...concepts.get('synthetic-concept'),
      uuid: 'synthetic-panel',
      display: 'Synthetic panel',
      conceptClass: { name: 'LabSet', display: 'LabSet' },
    });
    const parent = observation('synthetic-parent', 'synthetic-panel');
    delete parent.valueQuantity;
    parent.hasMember = [{ reference: 'Observation/synthetic-obs' }];
    state.entries.unshift(parent);
    const data = await loadPatientData('synthetic-patient');
    expect(data['synthetic-panel'].entries[0].members[0].id).toBe('synthetic-obs');
  });

  it('retains a member referenced by two panels', async () => {
    const { state, concepts } = setupApi();
    for (const uuid of ['synthetic-panel-a', 'synthetic-panel-b']) {
      concepts.set(uuid, {
        ...concepts.get('synthetic-concept'),
        uuid,
        display: uuid,
        conceptClass: { name: 'LabSet', display: 'LabSet' },
      });
      const parent = observation(uuid + '-obs', uuid);
      delete parent.valueQuantity;
      parent.hasMember = [{ reference: 'Observation/synthetic-obs' }];
      state.entries.unshift(parent);
    }
    const data = await loadPatientData('synthetic-patient');
    const members = ['synthetic-panel-a', 'synthetic-panel-b'].map((uuid) => data[uuid].entries[0].members[0]?.id);
    expect(members).toEqual(['synthetic-obs', 'synthetic-obs']);
  });
});

describe('reference range boundaries', () => {
  it.each([
    [{ high: { value: 10 } }, -5, '≤ 10 U/L', 'NORMAL'],
    [{ low: { value: 10 } }, 150, '≥ 10 U/L', 'NORMAL'],
    [{ low: { value: 10 } }, 5, '≥ 10 U/L', 'LOW'],
    [{ high: { value: 0 } }, 0, '≤ 0 U/L', 'NORMAL'],
    [{ low: { value: 0 } }, -1, '≥ 0 U/L', 'LOW'],
  ] as const)('uses only the provided boundary: %j at %s', async (range, value, display, interpretation) => {
    const { state } = setupApi();
    state.entries[0].valueQuantity.value = value;
    state.entries[0].referenceRange = [range];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe(display);
    expect(row.interpretation).toBe(interpretation);
  });

  it('uses a normal coding after an unrelated coding', async () => {
    const { state } = setupApi();
    state.entries[0].referenceRange = [
      {
        high: { value: 10 },
        type: {
          coding: [{ system: 'https://synthetic.invalid/codes', code: 'other' }, ...normalType.coding],
        },
      },
    ];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe('≤ 10 U/L');
    expect(row.interpretation).toBe('HIGH');
  });

  it('does not turn another range type into a normal range', async () => {
    const { state } = setupApi();
    state.entries[0].referenceRange = [{ high: { value: 10 }, type: { text: 'Synthetic other range' } }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe('0 – 100 U/L');
    expect(row.interpretation).toBe('NORMAL');
  });

  it('preserves a range with an explicit unit different from the result', async () => {
    const { state } = setupApi();
    state.entries[0].referenceRange = [{ high: { value: 10, unit: 'mg/dL' } }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.value.value).toBe('50 U/L');
    expect(row.range).toBe('≤ 10 mg/dL');
    expect(row.interpretation).toBe('--');
  });

  it('keeps server interpretation when result and catalog units differ', async () => {
    const { state, concepts } = setupApi();
    concepts.get('synthetic-concept').units = 'mg/dL';
    state.entries[0].interpretation = [{ coding: [{ code: 'HH' }] }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe('0 – 100 mg/dL');
    expect(row.interpretation).toBe('CRITICALLY_HIGH');
  });

  it('does not borrow critical catalog thresholds in different units', async () => {
    const { state, concepts } = setupApi();
    Object.assign(concepts.get('synthetic-concept'), { units: 'mg/dL', hiCritical: 20 });
    state.entries[0].referenceRange = [{ high: { value: 100 } }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe('≤ 100 U/L');
    expect(row.interpretation).toBe('NORMAL');
  });

  it('does not assign result units to a catalog range without units', async () => {
    const { concepts } = setupApi();
    concepts.get('synthetic-concept').units = undefined;
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe('0 – 100');
    expect(row.interpretation).toBe('--');
  });

  it('keeps conflicting bound units visible without calculating an interpretation', async () => {
    const { state } = setupApi();
    state.entries[0].referenceRange = [{ low: { value: 0, unit: 'mg/dL' }, high: { value: 10, unit: 'mmol/L' } }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe('0 mg/dL – 10 mmol/L');
    expect(row.interpretation).toBe('--');
  });

  it('preserves textual ranges in different units verbatim without classifying the result', async () => {
    const { state } = setupApi();
    state.entries[0].referenceRange = [{ text: '0 – 10 mg/dL' }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe('0 – 10 mg/dL');
    expect(row.interpretation).toBe('--');
  });

  it('can assess numeric range text without units when neither result nor catalog declares units', async () => {
    const { state, concepts } = setupApi();
    delete state.entries[0].valueQuantity.unit;
    concepts.get('synthetic-concept').units = undefined;
    state.entries[0].referenceRange = [{ text: '0 – 10' }];
    const [row] = parseSingleEntry(await loadSingle(), 'Test', 'Synthetic test');
    expect(row.range).toBe('0 – 10');
    expect(row.interpretation).toBe('HIGH');
  });
});

describe('sorting across numeric and textual results', () => {
  it('orders negative, decimal, comparator and textual values in both directions', async () => {
    const values = ['150 U/L', '2.5 U/L', '-10 U/L', '< 5 U/L', '1,2 U/L', 'Synthetic negative', '--'];
    const data = values.map(
      (value, i): OverviewPanelData => ({
        id: `synthetic-sort-${i}`,
        name: `Test ${i}`,
        range: '--',
        interpretation: '--',
        value: { value, interpretation: '--' },
      }),
    );
    render(<CommonDataTable data={data} tableHeaders={headers} />);
    const displayed = () => bodyRows().map((row) => within(row).getAllByRole('cell')[1].textContent);
    await sortBy('Value');
    const ascending = displayed();
    expect(ascending.slice(0, 5)).toEqual(['-10 U/L', '1,2 U/L', '2.5 U/L', '< 5 U/L', '150 U/L']);
    expect(ascending.slice(5)).toEqual(['--', 'Synthetic negative']);
    await sortBy('Value');
    expect(displayed()).toEqual([...ascending].reverse());
  });

  it.each([
    ['LOW', 'low'],
    ['CRITICALLY_HIGH', 'criticallyHigh'],
    ['CRITICALLY_LOW', 'criticallyLow'],
    ['OFF_SCALE_HIGH', 'offScaleHigh'],
    ['OFF_SCALE_LOW', 'offScaleLow'],
  ] as const)('keeps %s attached to its observation after sorting', async (interpretation, css) => {
    const data = [{ ...tableRows[0], interpretation, value: { ...tableRows[0].value, interpretation } }, tableRows[1]];
    render(<CommonDataTable data={data} tableHeaders={headers} />);
    await sortBy('Test name');
    expect(screen.getByRole('cell', { name: 'Alpha normal' }).closest('tr')).not.toHaveClass(css);
    expect(screen.getByRole('cell', { name: 'Zeta high' }).closest('tr')).toHaveClass(css);
  });
});

describe('pagination integrity and recovery', () => {
  it.each([
    '/openmrs/ws/fhir2/R4/?_getpages=synthetic-cursor',
    'https://synthetic-backend.invalid/openmrs/ws/fhir2/R4?_getpages=synthetic-cursor',
  ])('keeps an opaque cursor through the SPA proxy: %s', async (next) => {
    const { fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-a')], undefined, next)));
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-b')])));
    expect(await loadObsEntries('synthetic-patient')).toHaveLength(2);
    const url = new URL(String(fetchMock.mock.calls[1][0]));
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get('_getpages')).toBe('synthetic-cursor');
  });

  it.each([
    '/openmrs/ws/rest/v1/obs?_getpages=synthetic-cursor',
    '/openmrs/ws/fhir2/R4-other?_getpages=synthetic-cursor',
    '/openmrs/ws/fhir2/R4?patient=synthetic-other',
    '/openmrs/ws/fhir2/R4?patient=synthetic-patient&patient=synthetic-other',
    'ftp://synthetic.invalid/openmrs/ws/fhir2/R4?_getpages=synthetic-cursor',
  ])('rejects an invalid continuation without fetching it: %s', async (next) => {
    const { fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-a')], 2, next)));
    await expect(loadObsEntries('synthetic-patient')).rejects.toThrow('Test results could not be loaded.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('rejects partial overlap with next links (total present: %s)', async (withTotal) => {
    const { fetchMock } = setupApi();
    const total = withTotal ? 4 : undefined;
    fetchMock.mockResolvedValueOnce(
      response(
        bundle(
          [observation('synthetic-a'), observation('synthetic-b')],
          total,
          '/openmrs/ws/fhir2/R4?_getpages=synthetic-cursor',
        ),
      ),
    );
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-b'), observation('synthetic-c')], total)));
    await expect(loadObsEntries('synthetic-patient')).rejects.toThrow();
  });

  it('retains the advertised total when the final page omits it', async () => {
    const { fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-a')], 3)));
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-b')])));
    fetchMock.mockResolvedValueOnce(response(bundle([])));
    await expect(loadObsEntries('synthetic-patient')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects a changing total instead of declaring an inconsistent history complete', async () => {
    const { fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-a')], 2)));
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-b')], 3)));
    await expect(loadObsEntries('synthetic-patient')).rejects.toThrow();
  });

  it('shows a safe error for an overlapping history and reloads on retry', async () => {
    const { fetchMock } = setupApi();
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-a'), observation('synthetic-b')], 4)));
    fetchMock.mockResolvedValueOnce(response(bundle([observation('synthetic-b'), observation('synthetic-c')], 4)));
    render(<ExternalOverview patientUuid="synthetic-patient" filter={() => true} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Test results could not be loaded. Try again.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(document.body).not.toHaveTextContent('synthetic-cursor');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('cell', { name: '50 U/L' })).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
