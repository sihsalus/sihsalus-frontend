import { openmrsFetch } from '@openmrs/esm-framework';
import {
  mapConditionProperties,
  sortConditions,
  useConditionConceptSet,
  usePatientConditions,
} from '@openmrs/esm-patient-common-lib';
import { renderHook, waitFor } from '@testing-library/react';

import { createCondition, useConditionsFromConceptSet } from './conditions.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  usePatientConditions: vi.fn(),
  useConditionConceptSet: vi.fn(),
}));

const mockUsePatientConditions = vi.mocked(usePatientConditions);
const mockUseConditionConceptSet = vi.mocked(useConditionConceptSet);

function mockConceptSet(setMembers: Array<{ uuid: string }>) {
  mockUseConditionConceptSet.mockReturnValue({
    conceptSet: {
      uuid: 'synthetic-set',
      retired: false,
      setMembers: setMembers.map(({ uuid }) => ({ uuid, names: [], retired: false })),
    },
    error: undefined,
    isLoading: false,
  });
}

function mockHistory(data: Array<Parameters<typeof mapConditionProperties>[0]>) {
  mockUsePatientConditions.mockReturnValue({
    conditions: sortConditions(data.map(mapConditionProperties)),
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });
}

describe('conditions concept-set adapter', () => {
  it('keeps its concept filter over the shared reader and preserves the original resource', async () => {
    const source = {
      uuid: 'synthetic-member-condition',
      patient: { uuid: 'synthetic-patient' },
      condition: { coded: { uuid: 'synthetic-member', display: 'Synthetic antecedent' } },
      clinicalStatus: 'ACTIVE',
      voided: false,
    };
    mockHistory([
      source,
      {
        uuid: 'synthetic-text-condition',
        patient: { uuid: 'synthetic-patient' },
        condition: { nonCoded: 'Synthetic free text' },
        clinicalStatus: 'ACTIVE',
        voided: false,
      },
    ]);
    mockConceptSet([{ uuid: 'synthetic-member' }]);

    const { result } = renderHook(() => useConditionsFromConceptSet('synthetic-patient', 'synthetic-set'));

    await waitFor(() =>
      expect(result.current.conditions).toEqual([
        expect.objectContaining({ id: source.uuid, display: 'Synthetic antecedent', source }),
      ]),
    );
    expect(mockUsePatientConditions).toHaveBeenCalledWith('synthetic-patient');
  });

  it('does not add an antecedent category or note to an existing coded-only create flow', async () => {
    mockOpenmrsFetch.mockResolvedValue({ status: 201 } as never);

    await createCondition({
      patientId: 'synthetic-patient',
      providerUuid: 'synthetic-provider',
      conceptId: 'synthetic-member',
      display: 'Synthetic antecedent',
      clinicalStatus: 'active',
    });

    const request = mockOpenmrsFetch.mock.calls[0][1];
    expect(request.method).toBe('POST');
    const sentPayload = JSON.parse(JSON.stringify(request.body));
    expect(sentPayload).not.toHaveProperty('category');
    expect(sentPayload).not.toHaveProperty('additionalDetail');
    expect(sentPayload.condition).toEqual({ coded: 'synthetic-member' });
  });
});
