import { openmrsFetch, restBaseUrl, type FetchResponse } from '@openmrs/esm-framework';

import { createCompanionPerson, createCompanionRelationship } from './companion.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('companion resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the configured companion relationship in the correct direction', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { uuid: 'relationship-uuid' } } as FetchResponse<unknown>);

    await expect(
      createCompanionRelationship('patient-uuid', 'companion-uuid', 'relationship-type-uuid'),
    ).resolves.toBe('relationship-uuid');

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/relationship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        personA: 'companion-uuid',
        personB: 'patient-uuid',
        relationshipType: 'relationship-type-uuid',
      },
    });
  });

  it('creates a Person without creating a patient record', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { uuid: 'person-uuid', display: 'María Pérez' },
    } as FetchResponse<unknown>);
    const payload = {
      names: [{ givenName: 'María', familyName: 'Pérez', preferred: true }],
      gender: 'F',
      birthdate: '1980-01-01',
      birthdateEstimated: true,
    };

    await expect(createCompanionPerson(payload)).resolves.toEqual({
      uuid: 'person-uuid',
      display: 'María Pérez',
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/person`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
  });
});
