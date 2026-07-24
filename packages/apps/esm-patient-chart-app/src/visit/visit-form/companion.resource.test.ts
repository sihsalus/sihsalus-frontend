import { openmrsFetch, restBaseUrl, type FetchResponse } from '@openmrs/esm-framework';

import {
  createCompanionPerson,
  getCompanionPerson,
  getVisitCompanionPersonUuid,
  withVisitCompanionAttribute,
} from './companion.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('companion resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('loads the person selected as companion', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { uuid: 'person-uuid', display: 'María Pérez' },
    } as FetchResponse<unknown>);

    await expect(getCompanionPerson('person-uuid')).resolves.toEqual({
      uuid: 'person-uuid',
      display: 'María Pérez',
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/person/person-uuid?v=custom:(uuid,display)`);
  });

  it('reads the companion person UUID from a visit attribute', () => {
    expect(
      getVisitCompanionPersonUuid(
        [
          {
            attributeType: { uuid: 'companion-attribute-type' },
            value: 'person-uuid',
          },
        ],
        'companion-attribute-type',
      ),
    ).toBe('person-uuid');
  });

  it('supports object values returned by person-backed visit attributes', () => {
    expect(
      getVisitCompanionPersonUuid(
        [
          {
            attributeType: { uuid: 'companion-attribute-type' },
            value: { uuid: 'person-uuid', display: 'María Pérez' },
          },
        ],
        'companion-attribute-type',
      ),
    ).toBe('person-uuid');
  });

  it('adds the selected companion to the attributes of one visit', () => {
    expect(
      withVisitCompanionAttribute({ 'another-attribute': 'value' }, 'companion-attribute-type', 'person-uuid'),
    ).toEqual({
      'another-attribute': 'value',
      'companion-attribute-type': 'person-uuid',
    });
  });

  it('marks the companion attribute for deletion when it is cleared while editing', () => {
    expect(withVisitCompanionAttribute({}, 'companion-attribute-type', undefined)).toEqual({
      'companion-attribute-type': '',
    });
  });
});
