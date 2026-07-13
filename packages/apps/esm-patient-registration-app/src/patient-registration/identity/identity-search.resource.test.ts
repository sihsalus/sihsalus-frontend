import { openmrsFetch } from '@openmrs/esm-framework';

import { personDocumentNumberAttributeTypeUuid, personDocumentTypeAttributeTypeUuid } from './identity-documents';
import { isPersonAlreadyPatient, searchLocalIdentityByDocument } from './identity-search.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('searchLocalIdentityByDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches the number only within the requested document type', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: 'patient-with-hce',
              display: 'HCE collision',
              identifiers: [{ identifier: '12345678', identifierType: { uuid: 'hce-type' } }],
            },
            {
              uuid: 'patient-with-dni',
              display: 'DNI match',
              identifiers: [{ identifier: '12345678', identifierType: { uuid: 'dni-type' } }],
            },
            {
              uuid: 'patient-with-person-dni',
              display: 'Patient with legacy document attributes',
              identifiers: [{ identifier: '87654321', identifierType: { uuid: 'hce-type' } }],
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: 'person-with-passport',
              display: 'Passport collision',
              attributes: [
                { attributeType: { uuid: personDocumentNumberAttributeTypeUuid }, value: '12345678' },
                { attributeType: { uuid: personDocumentTypeAttributeTypeUuid }, value: { uuid: 'passport-concept' } },
              ],
            },
            {
              uuid: 'legacy-person-without-type',
              display: 'Legacy document match',
              attributes: [{ attributeType: { uuid: personDocumentNumberAttributeTypeUuid }, value: '12345678' }],
            },
            {
              uuid: 'patient-with-person-dni',
              display: 'Patient with legacy document attributes',
              attributes: [
                { attributeType: { uuid: personDocumentNumberAttributeTypeUuid }, value: '12345678' },
                { attributeType: { uuid: personDocumentTypeAttributeTypeUuid }, value: { uuid: 'dni-concept' } },
              ],
            },
          ],
        },
      } as never);

    const matches = await searchLocalIdentityByDocument('12345678', undefined, {
      patientIdentifierTypeUuid: 'dni-type',
      personDocumentTypeConceptUuid: 'dni-concept',
    });

    expect(matches).toEqual([
      expect.objectContaining({ kind: 'patient', uuid: 'patient-with-dni', identifierTypeUuid: 'dni-type' }),
      expect.objectContaining({ kind: 'person', uuid: 'legacy-person-without-type' }),
      expect.objectContaining({ kind: 'patient', uuid: 'patient-with-person-dni' }),
    ]);
  });
});

describe('isPersonAlreadyPatient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats a direct 404 status as a person that has not been promoted', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce({ status: 404 });

    await expect(isPersonAlreadyPatient('person-uuid')).resolves.toBe(false);
  });

  it('does not hide authorization or backend failures', async () => {
    const forbidden = { status: 403 };
    mockOpenmrsFetch.mockRejectedValueOnce(forbidden);

    await expect(isPersonAlreadyPatient('person-uuid')).rejects.toBe(forbidden);
  });
});
