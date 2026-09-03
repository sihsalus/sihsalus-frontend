import { openmrsFetch, useFhirFetchAll } from '@openmrs/esm-framework';
import { buildAntecedentTypeCategory, buildAntecedentTypeNote } from '@openmrs/esm-patient-common-lib';
import { renderHook, waitFor } from '@testing-library/react';
import { createCondition, updateCondition, useConditionsFromConceptSet } from './conditions.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseFhirFetchAll = vi.mocked(useFhirFetchAll);

function fhirCondition({
  id,
  conceptId,
  display,
  onsetDateTime,
  note,
  category,
}: {
  id: string;
  conceptId: string;
  display: string;
  onsetDateTime: string;
  note?: ReturnType<typeof buildAntecedentTypeNote>;
  category?: ReturnType<typeof buildAntecedentTypeCategory>;
}) {
  return {
    resource: {
      id,
      code: { coding: [{ code: conceptId, display }] },
      clinicalStatus: { coding: [{ code: 'active' }] },
      onsetDateTime,
      recordedDate: onsetDateTime,
      note,
      category,
    },
  };
}

describe('useConditionsFromConceptSet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFhirFetchAll.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);
  });

  it('incluye los antecedentes de texto libre y los muestra con el texto del clínico', async () => {
    const bundle = {
      total: 3,
      entry: [
        fhirCondition({
          id: 'in-set',
          conceptId: 'member-1',
          display: 'Asma',
          onsetDateTime: '2026-01-02T00:00:00.000Z',
          category: buildAntecedentTypeCategory('pathological'),
          note: buildAntecedentTypeNote('pathological', null),
        }),
        fhirCondition({
          id: 'free-text',
          conceptId: 'fallback-1',
          display: 'Nota de consulta',
          onsetDateTime: '2026-01-03T00:00:00.000Z',
          category: buildAntecedentTypeCategory('other'),
          note: buildAntecedentTypeNote('other', 'Alergia a mariscos'),
        }),
        fhirCondition({
          id: 'foreign',
          conceptId: 'unrelated-concept',
          display: 'Diagnóstico ajeno',
          onsetDateTime: '2026-01-04T00:00:00.000Z',
        }),
      ],
    };
    const conceptSet = {
      setMembers: [{ uuid: 'member-1', name: { display: 'Asma', name: 'Asma' } }],
    };

    mockUseFhirFetchAll.mockReturnValue({
      data: bundle.entry.map(({ resource }) => resource),
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);
    mockOpenmrsFetch.mockResolvedValue({ data: conceptSet } as never);

    const { result } = renderHook(() => useConditionsFromConceptSet('patient-c3', 'set-1', 'fallback-1'));

    await waitFor(() => expect(result.current.conditions).not.toBeNull());

    const conditions = result.current.conditions;
    expect(conditions.map((condition) => condition.id)).toEqual(['free-text', 'in-set']);
    expect(conditions.find((condition) => condition.id === 'free-text')?.display).toBe('Alergia a mariscos');
  });

  it('sin fallback configurado conserva el filtro estricto por miembros del set', async () => {
    const bundle = {
      total: 1,
      entry: [
        fhirCondition({
          id: 'free-text',
          conceptId: 'fallback-1',
          display: 'Nota de consulta',
          onsetDateTime: '2026-01-03T00:00:00.000Z',
          note: buildAntecedentTypeNote('other', 'Alergia a mariscos'),
        }),
      ],
    };
    const conceptSet = {
      setMembers: [{ uuid: 'member-1', name: { display: 'Asma', name: 'Asma' } }],
    };

    mockUseFhirFetchAll.mockReturnValue({
      data: bundle.entry.map(({ resource }) => resource),
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);
    mockOpenmrsFetch.mockResolvedValue({ data: conceptSet } as never);

    const { result } = renderHook(() => useConditionsFromConceptSet('patient-c3-strict', 'set-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.conditions).toEqual([]));
  });

  it('filters the complete result set returned by the FHIR paginator', async () => {
    const conceptSet = {
      setMembers: [
        { uuid: 'member-1', name: { display: 'Asma', name: 'Asma' } },
        { uuid: 'member-2', name: { display: 'Diabetes', name: 'Diabetes' } },
      ],
    };
    mockUseFhirFetchAll.mockReturnValue({
      data: [
        fhirCondition({
          id: 'first-page',
          conceptId: 'member-1',
          display: 'Asma',
          onsetDateTime: '2026-01-01T00:00:00.000Z',
        }).resource,
        fhirCondition({
          id: 'second-page',
          conceptId: 'member-2',
          display: 'Diabetes',
          onsetDateTime: '2026-01-02T00:00:00.000Z',
        }).resource,
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);
    mockOpenmrsFetch.mockResolvedValue({ data: conceptSet } as never);

    const { result } = renderHook(() => useConditionsFromConceptSet('patient-paginated', 'set-paginated'));

    await waitFor(() => expect(result.current.conditions?.map(({ id }) => id)).toEqual(['second-page', 'first-page']));
    expect(mockUseFhirFetchAll).toHaveBeenCalledWith(expect.stringContaining('/Condition?patient=patient-paginated'));
  });
});

describe('condition persistence', () => {
  const payload = {
    clinicalStatus: 'active',
    conceptId: 'concept-1',
    display: 'Asma',
    patientId: 'patient-1',
    providerUuid: 'provider-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as never);
  });

  it('does not construct a Practitioner reference from a user or provider UUID', async () => {
    await createCondition(payload);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/Condition'),
      expect.objectContaining({
        method: 'POST',
        body: expect.not.objectContaining({ recorder: expect.anything() }),
      }),
    );
  });

  it('preserves recordedDate when updating a condition', async () => {
    await updateCondition('condition-1', {
      ...payload,
      recordedDate: '2026-01-01T00:00:00.000Z',
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/Condition/condition-1'),
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({
          recordedDate: '2026-01-01T00:00:00.000Z',
        }),
      }),
    );
  });

  it('fails before POST when the session has no clinical provider', async () => {
    await expect(createCondition({ ...payload, providerUuid: '' })).rejects.toThrow(/clinical provider/i);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
