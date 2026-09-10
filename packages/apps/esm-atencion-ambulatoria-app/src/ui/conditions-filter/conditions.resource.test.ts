import { openmrsFetch } from '@openmrs/esm-framework';
import {
  type AntecedentTypeCode,
  buildAntecedentTypeNote,
  mapConditionProperties,
  type OpenmrsCondition,
  sortConditions,
  useConditionConceptSet,
  usePatientConditions,
} from '@openmrs/esm-patient-common-lib';
import { renderHook } from '@testing-library/react';
import { createCondition, updateCondition, useConditions, useConditionsFromConceptSet } from './conditions.resource';

vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  usePatientConditions: vi.fn(),
  useConditionConceptSet: vi.fn(),
}));
const fetchMock = vi.mocked(openmrsFetch);
const patientUuid = 'synthetic-patient';
const details = (type: AntecedentTypeCode, text?: string) => buildAntecedentTypeNote(type, text)?.[0]?.text;
const source = (uuid: string, overrides: Partial<OpenmrsCondition> = {}): OpenmrsCondition => ({
  uuid,
  patient: { uuid: patientUuid },
  condition: { coded: { uuid: 'member-1', display: 'Synthetic antecedent' } },
  clinicalStatus: 'ACTIVE',
  voided: false,
  ...overrides,
});
function mockHistory(records: Array<OpenmrsCondition>) {
  vi.mocked(usePatientConditions).mockReturnValue({
    conditions: sortConditions(records.map(mapConditionProperties)),
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });
}
function mockConceptSet(uuids: Array<string>) {
  vi.mocked(useConditionConceptSet).mockReturnValue({
    conceptSet: {
      uuid: 'synthetic-set',
      retired: false,
      setMembers: uuids.map((uuid) => ({ uuid, names: [], retired: false })),
    },
    error: undefined,
    isLoading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHistory([]);
  mockConceptSet(['member-1']);
});

describe('outpatient concept-set adapter', () => {
  it('keeps coded antecedents readable alongside a native uncoded record', () => {
    const coded = source('coded');
    mockHistory([coded, source('native', { condition: { nonCoded: 'Synthetic narrative' } })]);
    const { result } = renderHook(() => useConditionsFromConceptSet(patientUuid, 'synthetic-set'));
    expect(result.current.conditions).toEqual([expect.objectContaining({ id: 'coded', source: coded })]);
  });

  it('returns native text and an unknown status without inventing a coded concept or an active state', () => {
    mockHistory([source('native', { condition: { nonCoded: 'Synthetic narrative' }, clinicalStatus: 'UNKNOWN' })]);
    const { result } = renderHook(() => useConditions(patientUuid));
    expect(result.current.conditions).toEqual([
      expect.objectContaining({
        id: 'native',
        display: 'Synthetic narrative',
        conceptId: '',
        clinicalStatus: 'Unknown',
      }),
    ]);
  });

  it('retains configured historical text and displays its clinical note', () => {
    mockHistory([
      source('coded', { onsetDate: '2026-01-01' }),
      source('legacy', {
        condition: { coded: { uuid: 'legacy-fallback', display: 'Historical note concept' } },
        onsetDate: '2026-01-02',
        additionalDetail: details('other', 'Synthetic historical narrative'),
      }),
      source('foreign', { condition: { coded: { uuid: 'unrelated', display: 'Unrelated record' } } }),
    ]);
    const { result } = renderHook(() => useConditionsFromConceptSet(patientUuid, 'synthetic-set', 'legacy-fallback'));
    expect(result.current.conditions?.map(({ id }) => id)).toEqual(['legacy', 'coded']);
    expect(result.current.conditions?.[0].display).toBe('Synthetic historical narrative');
  });

  it('keeps the concept filter strict when no historical fallback is configured', () => {
    mockHistory([
      source('legacy', {
        condition: { coded: { uuid: 'legacy-fallback', display: 'Historical note concept' } },
        additionalDetail: details('other', 'Synthetic note'),
      }),
    ]);
    const { result } = renderHook(() => useConditionsFromConceptSet(patientUuid, 'synthetic-set'));
    expect(result.current.conditions).toEqual([]);
  });

  it('keeps new native other history visible without admitting family, social or unclassified records', () => {
    const native = source('native-other', {
      condition: { nonCoded: 'Synthetic personal history' },
      additionalDetail: details('other', 'Synthetic context'),
    });
    mockHistory([
      native,
      { ...native, uuid: 'family', additionalDetail: details('family') },
      { ...native, uuid: 'social', additionalDetail: details('social') },
      { ...native, uuid: 'unclassified', additionalDetail: undefined },
      { ...native, uuid: 'note-only', condition: {} },
      {
        ...native,
        uuid: 'foreign-coded',
        condition: { coded: { uuid: 'foreign', display: 'Foreign concept' }, nonCoded: native.condition.nonCoded },
      },
    ]);
    mockConceptSet([]);
    const { result } = renderHook(() => useConditionsFromConceptSet(patientUuid, 'synthetic-set'));
    expect(result.current.conditions).toEqual([
      expect.objectContaining({ id: 'native-other', source: native, display: 'Synthetic personal history' }),
    ]);
  });

  it('filters the complete sorted REST history and preserves its original records', () => {
    const older = source('first-page', { onsetDate: '2026-01-01' });
    const newer = source('second-page', { onsetDate: '2026-01-02' });
    mockHistory([older, newer]);
    const { result } = renderHook(() => useConditionsFromConceptSet(patientUuid, 'synthetic-set'));
    expect(result.current.conditions?.map(({ id }) => id)).toEqual(['second-page', 'first-page']);
    expect(result.current.conditions?.[0].source).toBe(newer);
    expect(usePatientConditions).toHaveBeenCalledWith(patientUuid);
  });
});

describe('outpatient persistence adapter', () => {
  const payload = {
    clinicalStatus: 'active',
    conceptId: 'member-1',
    display: 'Synthetic antecedent',
    patientId: patientUuid,
    providerUuid: 'synthetic-provider',
  };
  it('lets the authenticated backend derive authorship on create', async () => {
    fetchMock.mockResolvedValueOnce({ status: 201 } as never);
    await createCondition(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      '/ws/rest/v1/condition',
      expect.objectContaining({
        method: 'POST',
        body: { patient: patientUuid, condition: { coded: 'member-1' }, clinicalStatus: 'ACTIVE' },
      }),
    );
  });

  it('does not overwrite the original recorded date during a status correction', async () => {
    const original = source('condition-1', { auditInfo: { dateCreated: '2026-01-01T00:00:00.000Z' } });
    fetchMock.mockResolvedValueOnce({ data: original } as never).mockResolvedValueOnce({ status: 200 } as never);
    await updateCondition(original.uuid, { ...payload, clinicalStatus: 'inactive', originalCondition: original });
    expect(fetchMock).toHaveBeenCalledWith(
      '/ws/rest/v1/condition/condition-1',
      expect.objectContaining({ method: 'POST', body: { clinicalStatus: 'INACTIVE' } }),
    );
  });

  it('blocks a missing clinical provider before POST', async () => {
    await expect(createCondition({ ...payload, providerUuid: '' })).rejects.toThrow(/clinical provider/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
