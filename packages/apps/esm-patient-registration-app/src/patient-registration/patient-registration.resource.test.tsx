import { createAttachment, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import {
  fetchPersonRegistrationCopyData,
  generateIdentifier,
  savePatient,
  savePatientPhoto,
  savePatientPhotoAsAttachment,
  savePerson,
} from './patient-registration.resource';

const mockOpenmrsFetch = openmrsFetch as vi.Mock;
const mockCreateAttachment = vi.mocked(createAttachment);

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  createAttachment: vi.fn(),
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

  it('rejects authentication failures instead of leaving patient writes pending', () => {
    savePatient(null);
    generateIdentifier('synthetic-source-uuid');

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      `${restBaseUrl}/patient/`,
      expect.objectContaining({ rejectOnAuthFailure: true }),
    );
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/idgen/identifiersource/synthetic-source-uuid/identifier`,
      expect.objectContaining({ rejectOnAuthFailure: true }),
    );
  });
});

describe('savePerson', () => {
  it('posts to the OpenMRS person endpoint without patient identifiers', () => {
    const signal = new AbortController().signal;
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

    savePerson(person, signal);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/person`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: person,
      signal,
    });
  });
});

describe('fetchPersonRegistrationCopyData', () => {
  it('forwards the caller signal to the request', async () => {
    const signal = new AbortController().signal;
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { uuid: 'responsible-person-uuid' } });

    await fetchPersonRegistrationCopyData('responsible-person-uuid', signal);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining(`${restBaseUrl}/person/responsible-person-uuid?v=`),
      { signal },
    );
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
        comment: 'Patient photo',
        groupMembers: [],
        obsDatetime,
      }),
    );

    const file = formData.get('file') as File;
    expect(file.name).toBe('patient-photo.png');
    expect(file.type).toBe('image/png');
  });

  it('forwards the caller abort signal to the attachment fallback', async () => {
    const signal = new AbortController().signal;

    await savePatientPhotoAsAttachment('patient-uuid', 'data:image/png;base64,aGVsbG8=', signal);

    expect(mockCreateAttachment).toHaveBeenCalledWith(
      'patient-uuid',
      expect.objectContaining({
        fileDescription: 'Patient photo',
        fileName: 'patient-photo.png',
      }),
      signal,
    );
  });
});
