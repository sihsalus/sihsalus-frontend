import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import {
  loadEmergencyPatientRegistrationCheckpoint,
  saveEmergencyPatientRegistrationCheckpoint,
} from '../emergency-workflow/emergency-patient-registration-checkpoint';
import {
  EmergencyPatientIdentifierGenerationError,
  EmergencyPatientRegistrationAmbiguousError,
  EmergencyPatientRegistrationCheckpointUnavailableError,
  EmergencyPatientRegistrationConflictError,
  EmergencyPatientRegistrationVerificationError,
  type EmergencyPatientPayload,
  prepareEmergencyPatientIdentifier,
  saveEmergencyPatient,
} from './patient-registration.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const context = {
  identifier: 'HCE-10045',
  identifierSourceUuid: 'identifier-source-uuid',
  identifierTypeUuid: 'openmrs-id-type-uuid',
  locationUuid: 'registration-location-uuid',
};

const payload: EmergencyPatientPayload = {
  person: {
    names: [{ givenName: 'DESCONOCIDO', familyName: '(HCE-10045)', preferred: true }],
    gender: 'U',
    birthdateEstimated: true,
    attributes: [],
    addresses: [],
    dead: false,
  },
  identifiers: [
    {
      identifier: context.identifier,
      identifierType: context.identifierTypeUuid,
      location: context.locationUuid,
      preferred: true,
    },
  ],
};

const patient = {
  uuid: 'patient-uuid',
  display: 'HCE-10045 - DESCONOCIDO',
  voided: false,
  identifiers: [
    {
      uuid: 'identifier-uuid',
      identifier: context.identifier,
      display: `OpenMRS ID = ${context.identifier}`,
      preferred: true,
      voided: false,
      identifierType: { uuid: context.identifierTypeUuid, display: 'OpenMRS ID' },
      location: { uuid: context.locationUuid },
    },
  ],
  person: {
    uuid: 'patient-uuid',
    display: 'DESCONOCIDO',
    voided: false,
    gender: 'U',
    birthdateEstimated: true,
    preferredName: { givenName: 'DESCONOCIDO', familyName: '(HCE-10045)' },
  },
};

function response(data: unknown) {
  return { data, status: 200 } as Awaited<ReturnType<typeof openmrsFetch>>;
}

function searchResponse(results: Array<typeof patient> = []) {
  return response({ results });
}

describe('prepareEmergencyPatientIdentifier', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    sessionStorage.clear();
  });

  it('generates and validates an HCE when no registration is pending', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(response({ identifier: context.identifier }));

    await expect(
      prepareEmergencyPatientIdentifier({
        identifierSourceUuid: context.identifierSourceUuid,
        identifierTypeUuid: context.identifierTypeUuid,
        locationUuid: context.locationUuid,
      }),
    ).resolves.toBe(context.identifier);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/idgen/identifiersource/${context.identifierSourceUuid}/identifier`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reuses the HCE from a durable pending attempt without consuming another identifier', async () => {
    expect(saveEmergencyPatientRegistrationCheckpoint({ version: 1, ...context })).toBe(true);

    await expect(
      prepareEmergencyPatientIdentifier({
        identifierSourceUuid: context.identifierSourceUuid,
        identifierTypeUuid: context.identifierTypeUuid,
        locationUuid: context.locationUuid,
      }),
    ).resolves.toBe(context.identifier);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('fails closed when idgen returns no identifier', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(response({}));

    await expect(
      prepareEmergencyPatientIdentifier({
        identifierSourceUuid: context.identifierSourceUuid,
        identifierTypeUuid: context.identifierTypeUuid,
        locationUuid: context.locationUuid,
      }),
    ).rejects.toBeInstanceOf(EmergencyPatientIdentifierGenerationError);
  });
});

describe('saveEmergencyPatient', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    sessionStorage.clear();
  });

  it('pre-reads, creates once, and verifies the exact patient and HCE', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(searchResponse())
      .mockResolvedValueOnce(response({ uuid: patient.uuid }))
      .mockResolvedValueOnce(response(patient));

    await expect(saveEmergencyPatient(payload, context)).resolves.toMatchObject({
      data: { uuid: patient.uuid },
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/patient`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: payload,
    });
    expect(loadEmergencyPatientRegistrationCheckpoint()).toBeNull();
  });

  it('reconciles a patient creation whose HTTP response was lost', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(searchResponse())
      .mockRejectedValueOnce(new Error('network response lost'))
      .mockResolvedValueOnce(searchResponse([patient]))
      .mockResolvedValueOnce(response(patient));

    await expect(saveEmergencyPatient(payload, context)).resolves.toMatchObject({
      data: { uuid: patient.uuid },
    });
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === `${restBaseUrl}/patient`)).toHaveLength(1);
    expect(loadEmergencyPatientRegistrationCheckpoint()).toBeNull();
  });

  it('only reconciles a pending checkpoint and never repeats the patient POST', async () => {
    expect(saveEmergencyPatientRegistrationCheckpoint({ version: 1, ...context })).toBe(true);
    mockOpenmrsFetch.mockResolvedValueOnce(searchResponse([patient])).mockResolvedValueOnce(response(patient));

    await expect(saveEmergencyPatient(payload, context)).resolves.toMatchObject({ data: { uuid: patient.uuid } });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => url === `${restBaseUrl}/patient`)).toBe(false);
  });

  it('blocks a blind retry and preserves the checkpoint while the prior result remains unverified', async () => {
    expect(saveEmergencyPatientRegistrationCheckpoint({ version: 1, ...context })).toBe(true);
    mockOpenmrsFetch.mockResolvedValueOnce(searchResponse());

    await expect(saveEmergencyPatient(payload, context)).rejects.toBeInstanceOf(
      EmergencyPatientRegistrationAmbiguousError,
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(loadEmergencyPatientRegistrationCheckpoint()).toEqual({ version: 1, ...context });
  });

  it('reconciles a 2xx response whose body omitted the patient UUID', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(searchResponse())
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(searchResponse([patient]))
      .mockResolvedValueOnce(response(patient));

    await expect(saveEmergencyPatient(payload, context)).resolves.toMatchObject({ data: { uuid: patient.uuid } });
  });

  it('fails closed before POST when the patient search response is malformed', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(response({}));

    await expect(saveEmergencyPatient(payload, context)).rejects.toBeInstanceOf(
      EmergencyPatientRegistrationVerificationError,
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('rejects multiple patients carrying the same exact HCE', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(searchResponse([patient, { ...patient, uuid: 'duplicate-patient-uuid' }]));

    await expect(saveEmergencyPatient(payload, context)).rejects.toBeInstanceOf(
      EmergencyPatientRegistrationConflictError,
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('clears the checkpoint after a definitive rejection confirmed with an empty search', async () => {
    const rejection = { response: { status: 400 } };
    mockOpenmrsFetch
      .mockResolvedValueOnce(searchResponse())
      .mockRejectedValueOnce(rejection)
      .mockResolvedValueOnce(searchResponse());

    await expect(saveEmergencyPatient(payload, context)).rejects.toBe(rejection);
    expect(loadEmergencyPatientRegistrationCheckpoint()).toBeNull();
  });

  it('does not POST when the safety checkpoint cannot be persisted', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(searchResponse());
    vi.stubGlobal('sessionStorage', undefined);

    await expect(saveEmergencyPatient(payload, context)).rejects.toBeInstanceOf(
      EmergencyPatientRegistrationCheckpointUnavailableError,
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
