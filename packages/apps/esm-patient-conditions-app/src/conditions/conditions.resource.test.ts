import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';

import {
  createCondition,
  type FHIRCondition,
  type FHIRConditionResponse,
  type FormFields,
  syncConditionCache,
  updateCondition,
} from './conditions.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const basePayload: FormFields = {
  antecedentType: 'pathological',
  clinicalStatus: 'active',
  conceptId: 'concept-uuid',
  display: 'Hypertension',
  patientId: 'patient-uuid',
  providerUuid: 'provider-uuid',
};

describe('conditions FHIR resource', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockResolvedValue({ status: 200 } as FetchResponse);
  });

  it('lets the backend derive the recorder and omits empty dates', async () => {
    await createCondition({
      ...basePayload,
      abatementDateTime: null,
      onsetDateTime: null,
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/fhir2/R4/Condition',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          subject: { reference: 'Patient/patient-uuid' },
        }),
      }),
    );

    const requestBody = mockOpenmrsFetch.mock.calls[0][1].body;
    // A Practitioner reference makes the FHIR translator resolve the recorder
    // through UserService, which clinical roles cannot do (Get Users). The
    // backend records the authenticated user on its own.
    expect(requestBody).not.toHaveProperty('recorder');
    expect(requestBody).not.toHaveProperty('onsetDateTime');
    expect(requestBody).not.toHaveProperty('abatementDateTime');
  });

  it('keeps supplied dates when updating a condition', async () => {
    await updateCondition('condition-uuid', {
      ...basePayload,
      clinicalStatus: 'inactive',
      abatementDateTime: '2026-07-14T12:00:00.000Z',
      onsetDateTime: '2026-07-01T12:00:00.000Z',
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/fhir2/R4/Condition/condition-uuid',
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({
          id: 'condition-uuid',
          onsetDateTime: '2026-07-01T12:00:00.000Z',
          abatementDateTime: '2026-07-14T12:00:00.000Z',
        }),
      }),
    );
  });

  it('rejects a write before sending Practitioner/undefined', async () => {
    await expect(createCondition({ ...basePayload, providerUuid: '' })).rejects.toThrow(
      'A clinical provider is required',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('adds the authoritative mutation response to the existing SWR bundle without another request', async () => {
    const existingCondition = {
      id: 'existing-condition',
      resourceType: 'Condition',
    } as FHIRCondition;
    const createdCondition = {
      id: 'created-condition',
      resourceType: 'Condition',
    } as FHIRCondition;
    const cachedResponse = {
      data: {
        entry: [{ resource: existingCondition }],
        total: 1,
      } as FHIRConditionResponse,
    } as FetchResponse<FHIRConditionResponse>;
    const mutate = vi.fn(async (updater) => updater(cachedResponse));

    await syncConditionCache(mutate, createdCondition);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(expect.any(Function), { revalidate: false });
    expect(await mutate.mock.results[0].value).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          entry: [{ resource: createdCondition }, { resource: existingCondition }],
          total: 2,
        }),
      }),
    );
  });

  it('replaces an updated condition in cache without duplicating the bundle entry', async () => {
    const existingCondition = {
      id: 'condition-id',
      resourceType: 'Condition',
      recordedDate: '2026-08-04T12:00:00.000Z',
    } as FHIRCondition;
    const updatedCondition = {
      ...existingCondition,
      recordedDate: '2026-08-04T13:00:00.000Z',
    };
    const cachedResponse = {
      data: {
        entry: [{ resource: existingCondition }],
        total: 1,
      } as FHIRConditionResponse,
    } as FetchResponse<FHIRConditionResponse>;
    const mutate = vi.fn(async (updater) => updater(cachedResponse));

    await syncConditionCache(mutate, updatedCondition);

    expect(await mutate.mock.results[0].value).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          entry: [{ resource: updatedCondition }],
          total: 1,
        }),
      }),
    );
  });

  it('falls back to a revalidation when no condition resource can be merged into cache', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined);

    await syncConditionCache(mutate, undefined);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith();
  });
});
