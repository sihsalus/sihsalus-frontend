import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';

import { createCondition, type FormFields, updateCondition } from './conditions.resource';

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

  it('uses the clinical provider as the FHIR Practitioner and omits empty dates', async () => {
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
          recorder: { reference: 'Practitioner/provider-uuid' },
          subject: { reference: 'Patient/patient-uuid' },
        }),
      }),
    );

    const requestBody = mockOpenmrsFetch.mock.calls[0][1].body;
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
          recorder: { reference: 'Practitioner/provider-uuid' },
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
});
