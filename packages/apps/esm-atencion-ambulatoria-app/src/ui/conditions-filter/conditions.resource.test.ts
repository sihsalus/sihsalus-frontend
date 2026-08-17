import { openmrsFetch } from '@openmrs/esm-framework';
import { buildAntecedentTypeCategory, buildAntecedentTypeNote } from '@openmrs/esm-patient-common-lib';
import { renderHook, waitFor } from '@testing-library/react';
import { useConditionsFromConceptSet } from './conditions.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

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
    const conceptSet = { setMembers: [{ uuid: 'member-1', name: { display: 'Asma', name: 'Asma' } }] };

    mockOpenmrsFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('/Condition') ? ({ data: bundle } as never) : ({ data: conceptSet } as never)),
    );

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
    const conceptSet = { setMembers: [{ uuid: 'member-1', name: { display: 'Asma', name: 'Asma' } }] };

    mockOpenmrsFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('/Condition') ? ({ data: bundle } as never) : ({ data: conceptSet } as never)),
    );

    const { result } = renderHook(() => useConditionsFromConceptSet('patient-c3-strict', 'set-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.conditions).toEqual([]));
  });
});
