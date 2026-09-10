import { type FetchResponse, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { mapConditionProperties, sortConditions, usePatientConditions } from '@openmrs/esm-patient-common-lib';
import { renderHook, waitFor } from '@testing-library/react';

import {
  createCondition,
  type FormFields,
  type OpenmrsCondition,
  syncConditionCache,
  updateCondition,
  useConditions,
  useConditionsSearch,
} from './conditions.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  usePatientConditions: vi.fn(),
}));

const mockUsePatientConditions = vi.mocked(usePatientConditions);

function mockHistory(data: Array<Parameters<typeof mapConditionProperties>[0]>) {
  mockUsePatientConditions.mockReturnValue({
    conditions: sortConditions(data.map(mapConditionProperties)),
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });
}

const basePayload: FormFields = {
  antecedentType: 'pathological',
  clinicalStatus: 'active',
  conceptId: 'concept-uuid',
  display: 'Synthetic antecedent',
  patientId: 'patient-uuid',
  providerUuid: 'provider-uuid',
};

const originalCondition: OpenmrsCondition = {
  uuid: 'condition-uuid',
  patient: { uuid: 'patient-uuid' },
  condition: { coded: { uuid: 'concept-uuid', display: 'Synthetic antecedent' } },
  clinicalStatus: 'ACTIVE',
  voided: false,
  auditInfo: { dateCreated: '2026-07-01T12:00:00.000Z' },
};

describe('conditions REST resource adapter', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockResolvedValue({ status: 200 } as FetchResponse);
    mockHistory([]);
  });

  it('uses the complete shared REST reader including inactive antecedents', () => {
    renderHook(() => useConditions('synthetic-patient'));

    expect(mockUsePatientConditions).toHaveBeenCalledWith('synthetic-patient');
  });

  it('encodes clinical search terms without allowing them to change the REST query', async () => {
    vi.mocked(useConfig).mockReturnValue({ conditionConceptClassUuid: 'synthetic-class' });
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } } as never);

    renderHook(() => useConditionsSearch('synthetic & class=another#?'));

    await waitFor(() =>
      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        '/ws/rest/v1/concept?name=synthetic%20%26%20class%3Danother%23%3F&searchType=fuzzy&class=synthetic-class&v=custom:(uuid,display)',
        { rejectOnAuthFailure: true },
      ),
    );
  });

  it('surfaces a denied diagnosis catalog request and stops searching', async () => {
    vi.mocked(useConfig).mockReturnValue({ conditionConceptClassUuid: 'synthetic-class' });
    const denied = Object.assign(new Error('Synthetic denied catalog request'), { status: 403 });
    mockOpenmrsFetch.mockRejectedValue(denied);

    const { result } = renderHook(() => useConditionsSearch('synthetic denied concept'));

    await waitFor(() => expect(result.current.error).toBe(denied));
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchResults).toEqual([]);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.any(String), { rejectOnAuthFailure: true });
  });

  it('does not fall back to an unrestricted concept search when the class is unavailable', () => {
    vi.mocked(useConfig).mockReturnValue({});

    const { result } = renderHook(() => useConditionsSearch('synthetic missing class'));

    expect(result.current.searchResults).toEqual([]);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('loads a text-only antecedent without inventing a concept or clinical status', () => {
    const source: OpenmrsCondition = {
      uuid: 'synthetic-text-antecedent',
      patient: { uuid: 'synthetic-patient' },
      clinicalStatus: 'UNKNOWN',
      condition: { nonCoded: 'Synthetic historical antecedent' },
      voided: false,
    };
    mockHistory([source]);

    const { result } = renderHook(() => useConditions('synthetic-patient'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.conditions).toEqual([
      expect.objectContaining({
        id: source.uuid,
        conceptId: '',
        display: 'Synthetic historical antecedent',
        clinicalStatus: 'Unknown',
        source,
      }),
    ]);
  });

  it('lets the backend derive the recorder and omits empty dates', async () => {
    await createCondition({ ...basePayload, abatementDateTime: null, onsetDateTime: null });

    const request = mockOpenmrsFetch.mock.calls[0];
    expect(request[0]).toBe('/ws/rest/v1/condition');
    expect(request[1]).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(request[1].body).not.toHaveProperty('recorder');
    expect(request[1].body).not.toHaveProperty('onsetDate');
    expect(request[1].body).not.toHaveProperty('endDate');
  });

  it('keeps the original recorded date and applies the edited clinical dates', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: originalCondition } as FetchResponse<OpenmrsCondition>);
    await updateCondition(originalCondition.uuid, {
      ...basePayload,
      originalCondition,
      clinicalStatus: 'inactive',
      abatementDateTime: '2026-07-14T12:00:00.000Z',
      onsetDateTime: '2026-07-01T12:00:00.000Z',
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/condition/condition-uuid',
      expect.objectContaining({
        method: 'POST',
        body: {
          clinicalStatus: 'INACTIVE',
          onsetDate: '2026-07-01T12:00:00.000Z',
          endDate: '2026-07-14T12:00:00.000Z',
          additionalDetail: '__sihsalus_antecedent_type:pathological',
        },
      }),
    );
  });

  it('rejects writes without a clinical provider', async () => {
    await expect(createCondition({ ...basePayload, providerUuid: '' })).rejects.toThrow(/clinical provider/i);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it.each([
    'onsetDateTime',
    'abatementDateTime',
  ] as const)('rejects removal of an existing %s before a request can report a false success', async (dateField) => {
    await expect(
      updateCondition(originalCondition.uuid, {
        ...basePayload,
        clinicalStatus: 'inactive',
        [dateField]: null,
        originalCondition: {
          ...originalCondition,
          onsetDate: '2026-06-20',
          endDate: '2026-07-01',
          clinicalStatus: 'INACTIVE',
        },
      }),
    ).rejects.toThrow(/cannot be removed/i);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('revalidates the authoritative paginated history after a successful save', async () => {
    const mutate = vi.fn().mockResolvedValue([]);

    await syncConditionCache(mutate);

    expect(mutate).toHaveBeenCalledExactlyOnceWith();
  });

  it('does not hide a failed history refresh after saving', async () => {
    const refreshError = new Error('Synthetic refresh error');
    const mutate = vi.fn().mockRejectedValue(refreshError);

    await expect(syncConditionCache(mutate)).rejects.toBe(refreshError);
  });
});
