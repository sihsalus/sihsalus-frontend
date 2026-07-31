import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';

import { useCurrentPregnancy } from './useCurrentPregnancy';
import { useObstetricRisk } from './useObstetricRisk';

vi.mock('./useCurrentPregnancy', async () => ({
  ...(await vi.importActual('./useCurrentPregnancy')),
  useCurrentPregnancy: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig);
const mockUseCurrentPregnancy = vi.mocked(useCurrentPregnancy);

const PREGNANCY_START = '2026-01-10T00:00:00.000Z';

// SWR keys on the request URL, which embeds the patient. A fresh uuid per test
// keeps one case's cached response from answering the next one's fetch.
let patientCounter = 0;
const nextPatient = () => `patient-uuid-${++patientCounter}`;

const CONCEPTS = {
  classificationConceptUuid: 'classification-uuid',
  lowRiskConceptUuid: 'low-uuid',
  highRiskConceptUuid: 'high-uuid',
  veryHighRiskConceptUuid: 'very-high-uuid',
  riskFactorsConceptUuid: 'factors-uuid',
};

/** Route each SWR fetch by the concept it asks for, so ordering cannot matter. */
function respondWith({ classifications = [], factors = [] }: { classifications?: unknown[]; factors?: unknown[] }) {
  mockOpenmrsFetch.mockImplementation((url: string) => {
    const results = url.includes(CONCEPTS.classificationConceptUuid) ? classifications : factors;
    return Promise.resolve({ data: { results } }) as ReturnType<typeof openmrsFetch>;
  });
}

function classification(valueUuid: string, obsDatetime: string) {
  return { uuid: `obs-${obsDatetime}`, value: { uuid: valueUuid, display: valueUuid }, obsDatetime };
}

describe('useObstetricRisk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({ obstetricRisk: CONCEPTS });
    mockUseCurrentPregnancy.mockReturnValue({
      pregnancyStartDate: PREGNANCY_START,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCurrentPregnancy>);
  });

  it('reports the most recent classification, not the first one returned', async () => {
    // The dangerous failure: a woman classified high risk last week still shows
    // the "bajo" from her booking visit because the API happened to return it
    // first. Deliberately out of chronological order.
    respondWith({
      classifications: [
        classification(CONCEPTS.lowRiskConceptUuid, '2026-01-15T10:00:00.000Z'),
        classification(CONCEPTS.veryHighRiskConceptUuid, '2026-03-20T10:00:00.000Z'),
        classification(CONCEPTS.highRiskConceptUuid, '2026-02-01T10:00:00.000Z'),
      ],
    });

    const patient = nextPatient();

    const { result } = renderHook(() => useObstetricRisk(patient));

    await waitFor(() => expect(result.current.riskLevel).toBe('muy-alto'));
    expect(result.current.lastEvaluationDate).toBe('20/03/2026');
  });

  it('ignores a classification recorded before the current pregnancy began', async () => {
    // A previous pregnancy's "bajo riesgo" must not follow the patient into
    // this one.
    respondWith({
      classifications: [classification(CONCEPTS.lowRiskConceptUuid, '2025-06-01T10:00:00.000Z')],
    });

    const patient = nextPatient();

    const { result } = renderHook(() => useObstetricRisk(patient));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.riskLevel).toBe('indeterminado');
    expect(result.current.lastEvaluationDate).toBeNull();
  });

  it('falls back to indeterminado rather than a reassuring default', async () => {
    // An unrecognised concept means the classification is unknown. Showing
    // "bajo" would be worse than showing nothing.
    respondWith({
      classifications: [classification('some-other-concept', '2026-02-01T10:00:00.000Z')],
    });

    const patient = nextPatient();

    const { result } = renderHook(() => useObstetricRisk(patient));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.riskLevel).toBe('indeterminado');
  });

  it('maps each configured concept to its risk level', async () => {
    for (const [conceptUuid, expected] of [
      [CONCEPTS.lowRiskConceptUuid, 'bajo'],
      [CONCEPTS.highRiskConceptUuid, 'alto'],
      [CONCEPTS.veryHighRiskConceptUuid, 'muy-alto'],
    ] as const) {
      respondWith({ classifications: [classification(conceptUuid, '2026-02-01T10:00:00.000Z')] });

      const patient = nextPatient();

      const { result, unmount } = renderHook(() => useObstetricRisk(patient));
      await waitFor(() => expect(result.current.riskLevel).toBe(expected));
      unmount();
    }
  });

  it('lists risk factors from the current pregnancy only', async () => {
    respondWith({
      classifications: [classification(CONCEPTS.highRiskConceptUuid, '2026-02-01T10:00:00.000Z')],
      factors: [
        { uuid: 'f1', value: { display: 'Preeclampsia' }, obsDatetime: '2026-02-02T10:00:00.000Z' },
        { uuid: 'f2', value: { display: 'De un embarazo anterior' }, obsDatetime: '2025-05-02T10:00:00.000Z' },
      ],
    });

    const patient = nextPatient();

    const { result } = renderHook(() => useObstetricRisk(patient));

    await waitFor(() => expect(result.current.riskFactors).toEqual(['Preeclampsia']));
  });

  it('stays indeterminado while the pregnancy episode is unknown', async () => {
    // Without a pregnancy start date every observation is out of episode, so
    // the hook must not classify at all.
    mockUseCurrentPregnancy.mockReturnValue({
      pregnancyStartDate: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCurrentPregnancy>);
    respondWith({
      classifications: [classification(CONCEPTS.lowRiskConceptUuid, '2026-02-01T10:00:00.000Z')],
    });

    const patient = nextPatient();

    const { result } = renderHook(() => useObstetricRisk(patient));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.riskLevel).toBe('indeterminado');
  });

  it('surfaces a pregnancy lookup failure instead of reporting no risk', async () => {
    const error = new Error('pregnancy lookup failed');
    mockUseCurrentPregnancy.mockReturnValue({
      pregnancyStartDate: undefined,
      isLoading: false,
      error,
    } as unknown as ReturnType<typeof useCurrentPregnancy>);
    respondWith({});

    const patient = nextPatient();

    const { result } = renderHook(() => useObstetricRisk(patient));

    await waitFor(() => expect(result.current.error).toBe(error));
  });
});
