import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { savePatient, savePatientPhoto, savePerson } from './patient-registration.resource';

const mockOpenmrsFetch = openmrsFetch as vi.Mock;

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
}));

beforeEach(() => {
  mockOpenmrsFetch.mockReset();
});

describe('savePatient', () => {
  it('appends patient uuid in url if provided', () => {
    mockOpenmrsFetch.mockImplementationOnce((url) => url);
    savePatient(null, '1234');
    expect(mockOpenmrsFetch.mock.calls[0][0]).toEqual(`${restBaseUrl}/patient/1234`);
  });

  it('does not append patient uuid in url', () => {
    mockOpenmrsFetch.mockImplementationOnce(() => {});
    savePatient(null);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toEqual(`${restBaseUrl}/patient/`);
  });
});

describe('savePerson', () => {
  it('posts to the OpenMRS person endpoint without patient identifiers', () => {
    const person = {
      names: [
        {
          givenName: 'Maria',
          familyName: 'Quispe',
          preferred: true,
        },
      ],
      gender: 'F',
    };

    savePerson(person);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/person`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: person,
      signal: expect.any(AbortSignal),
    });
  });
});

describe('savePatientPhoto', () => {
  it('posts complex obs metadata as multipart fields', async () => {
    const obsUrl = `${restBaseUrl}/obs`;
    const obsDatetime = '2026-05-29T05:00:00.000Z';

    mockOpenmrsFetch.mockResolvedValueOnce({});

    await savePatientPhoto(
      'patient-uuid',
      'data:image/png;base64,aGVsbG8=',
      obsUrl,
      obsDatetime,
      'patient-photo-concept-uuid',
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      obsUrl,
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );

    const formData = mockOpenmrsFetch.mock.calls[0][1].body as FormData;
    expect(formData.get('patient')).toBe('patient-uuid');
    expect(formData.get('person')).toBe('patient-uuid');
    expect(formData.get('concept')).toBe('patient-photo-concept-uuid');
    expect(formData.get('obsDatetime')).toBe(obsDatetime);
    expect(formData.get('json')).toBe(
      JSON.stringify({
        person: 'patient-uuid',
        concept: 'patient-photo-concept-uuid',
        groupMembers: [],
        obsDatetime,
      }),
    );

    const file = formData.get('file') as File;
    expect(file.name).toBe('patient-photo.png');
    expect(file.type).toBe('image/png');
  });
});
