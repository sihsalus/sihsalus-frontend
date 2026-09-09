import 'fake-indexeddb/auto';
import { getDefaultsFromConfigSchema, type Session } from '@openmrs/esm-framework';
import { OfflineDb } from '../../../libs/esm-offline/src/offline-db';
import {
  getOfflineSynchronizationStore,
  getSynchronizationItems,
  queueSynchronizationItem,
  runSynchronization,
  setupOfflineSync,
} from '../../../libs/esm-offline/src/sync';
import { esmPatientRegistrationSchema, type RegistrationConfig } from './config-schema';
import { syncPatientRegistration } from './offline';
import { FormManager, SavePatientTransactionManager } from './patient-registration/form-manager';
import {
  generateIdentifier,
  savePatient,
  savePerson,
  saveRelationship,
} from './patient-registration/patient-registration.resource';
import type { FormValues, PatientRegistration } from './patient-registration/patient-registration.types';

const { sessionStore } = vi.hoisted(() => ({
  sessionStore: {
    getState: () => ({
      loaded: true,
      session: { authenticated: true, user: { uuid: 'synthetic-owner', privileges: [] } },
    }),
    subscribe: () => () => {},
  },
}));
vi.mock('@openmrs/esm-api', async () => ({
  ...(await vi.importActual('@openmrs/esm-api')),
  getLoggedInUser: async () => sessionStore.getState().session.user,
  getSessionStore: () => sessionStore,
}));
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getSessionStore: () => sessionStore,
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  queueSynchronizationItem: (
    await vi.importActual<typeof import('../../../libs/esm-offline/src/sync')>('../../../libs/esm-offline/src/sync')
  ).queueSynchronizationItem,
}));
vi.mock('./patient-registration/patient-registration.resource', async () => ({
  ...(await vi.importActual('./patient-registration/patient-registration.resource')),
  savePatient: vi.fn(),
  generateIdentifier: vi.fn(),
  savePerson: vi.fn(),
  saveRelationship: vi.fn(),
}));

const db = new OfflineDb();
const rejectedWrite = { response: { status: 400 } };
function makeQueued(): PatientRegistration {
  const formValues: FormValues = {
    patientUuid: 'synthetic-patient',
    givenName: 'Synthetic',
    middleName: '',
    familyName: 'Audit',
    familyName2: '',
    additionalGivenName: '',
    additionalMiddleName: '',
    additionalFamilyName: '',
    additionalFamilyName2: '',
    addNameInLocalLanguage: false,
    gender: 'F',
    birthdate: '1990-01-01',
    birthdateEstimated: false,
    yearsEstimated: '',
    monthsEstimated: '',
    telephoneNumber: '',
    address: {},
    birthAddress: {},
    isDead: false,
    deathCause: '',
    deathDate: '',
    deathTime: '',
    deathTimeFormat: 'AM',
    nonCodedCauseOfDeath: '',
    identifiers: {},
    obs: {},
    relationships: [
      {
        relatedPersonUuid: 'synthetic-responsible',
        relationshipType: 'synthetic-relationship/aIsToB',
        action: 'ADD',
        clientId: 'synthetic-row',
      },
    ],
  };
  return {
    fhirPatient: { resourceType: 'Patient', id: formValues.patientUuid },
    _patientRegistrationData: {
      isNewPatient: true,
      formValues,
      patientUuidMap: {},
      initialAddressFieldValues: {},
      capturePhotoProps: null,
      currentLocation: 'synthetic-location',
      identifierTypes: [],
      initialIdentifierValues: {},
      currentUser: sessionStore.getState().session as Session,
      config: getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig,
      savePatientTransactionManager: new SavePatientTransactionManager(),
    },
  };
}
async function enqueue(queued = makeQueued()) {
  await queueSynchronizationItem('patient-registration', queued, { id: 'synthetic-patient' });
  return queued;
}
async function pending() {
  return (await getSynchronizationItems<PatientRegistration>('patient-registration'))[0];
}

beforeEach(async () => {
  await db.syncQueue.clear();
  vi.clearAllMocks();
  vi.mocked(savePatient).mockReset();
  vi.mocked(generateIdentifier).mockReset();
  vi.mocked(savePerson).mockReset();
  vi.mocked(saveRelationship).mockReset();
  vi.stubGlobal('navigator', {
    locks: {
      request: async (name: string, _options: LockOptions, callback: LockGrantedCallback<unknown>) =>
        callback({ name, mode: 'exclusive' } as Lock),
    },
  });
  setupOfflineSync('patient-registration', [], syncPatientRegistration);
  vi.mocked(savePatient).mockResolvedValue({ ok: true, data: { uuid: 'synthetic-patient' } } as never);
  vi.mocked(savePerson).mockResolvedValue({ ok: true, data: { uuid: 'synthetic-new-responsible' } } as never);
  vi.mocked(saveRelationship).mockResolvedValue({ ok: true, data: { uuid: 'synthetic-relationship' } } as never);
});
afterEach(async () => {
  await db.syncQueue.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('resumes after a rejected relationship without repeating confirmed patient creation', async () => {
  vi.mocked(saveRelationship).mockRejectedValueOnce(rejectedWrite);
  await enqueue();
  await expect(runSynchronization()).rejects.toThrow();
  expect((await pending())._patientRegistrationData.savePatientTransactionManager).toMatchObject({
    patientSaved: true,
    savedPatientUuid: 'synthetic-patient',
    pendingWrites: {},
  });
  await runSynchronization();
  expect(savePatient).toHaveBeenCalledOnce();
  expect(saveRelationship).toHaveBeenCalledTimes(2);
  expect(await pending()).toBeUndefined();
});

it('blocks an ambiguous patient response before any repeat write', async () => {
  vi.mocked(savePatient).mockRejectedValueOnce(new TypeError('Synthetic lost response'));
  await enqueue();
  await expect(runSynchronization()).rejects.toThrow();
  expect((await pending())._patientRegistrationData.savePatientTransactionManager.pendingWrites).toEqual({
    patient: true,
  });
  await expect(runSynchronization()).rejects.toThrow();
  expect(savePatient).toHaveBeenCalledOnce();
  expect(saveRelationship).not.toHaveBeenCalled();
});

it('retains an attempted write when cancellation prevents its completion checkpoint', async () => {
  vi.mocked(savePatient).mockImplementationOnce(async () => {
    getOfflineSynchronizationStore().getState().synchronization?.abortController.abort();
    return { ok: true, data: { uuid: 'synthetic-patient' } } as never;
  });
  await enqueue();
  await expect(runSynchronization()).rejects.toThrow();
  expect((await pending())._patientRegistrationData.savePatientTransactionManager.pendingWrites).toEqual({
    patient: true,
  });
  await expect(runSynchronization()).rejects.toThrow();
  expect(savePatient).toHaveBeenCalledOnce();
  expect(saveRelationship).not.toHaveBeenCalled();
});

it('reuses the confirmed responsible person after a later relationship rejection', async () => {
  const queued = makeQueued();
  Object.assign(queued._patientRegistrationData.formValues.relationships[0], {
    relatedPersonUuid: '',
    newPerson: {
      givenName: 'Synthetic',
      middleName: '',
      familyName: 'Responsible',
      familyName2: 'Audit',
      gender: 'female',
      estimatedAge: '40',
      phone: '',
      address: {},
      relationshipType: 'synthetic-relationship/aIsToB',
    },
  });
  vi.mocked(saveRelationship).mockRejectedValueOnce(rejectedWrite);
  await enqueue(queued);
  await expect(runSynchronization()).rejects.toThrow();
  expect(
    (await pending())._patientRegistrationData.savePatientTransactionManager.relationshipRows['synthetic-row'],
  ).toMatchObject({
    relatedPersonUuid: 'synthetic-new-responsible',
  });
  await runSynchronization();
  expect(savePatient).toHaveBeenCalledOnce();
  expect(savePerson).toHaveBeenCalledOnce();
  expect(saveRelationship).toHaveBeenLastCalledWith(
    expect.objectContaining({ personA: 'synthetic-new-responsible' }),
    expect.any(AbortSignal),
  );
});

it('reuses a confirmed main relationship when only the companion operation failed', async () => {
  const queued = makeQueued();
  queued._patientRegistrationData.config.relationshipOptions.companionRelationshipType = 'synthetic-companion/aIsToB';
  queued._patientRegistrationData.formValues.relationships[0].isCompanion = true;
  vi.mocked(saveRelationship)
    .mockResolvedValueOnce({ ok: true, data: { uuid: 'synthetic-main' } } as never)
    .mockRejectedValueOnce(rejectedWrite);
  await enqueue(queued);
  await expect(runSynchronization()).rejects.toThrow();
  await runSynchronization();
  expect(savePatient).toHaveBeenCalledOnce();
  expect(vi.mocked(saveRelationship).mock.calls.map(([body]) => body.relationshipType)).toEqual([
    'synthetic-relationship',
    'synthetic-companion',
    'synthetic-companion',
  ]);
});

it('does not let an offline edit replace a registration after a confirmed partial write', async () => {
  vi.mocked(saveRelationship).mockRejectedValueOnce(rejectedWrite);
  const queued = await enqueue();
  await expect(runSynchronization()).rejects.toThrow();
  const saved = await pending();
  const data = queued._patientRegistrationData;
  await expect(
    FormManager.savePatientFormOffline(
      data.isNewPatient,
      { ...data.formValues, givenName: 'Synthetic changed' },
      data.patientUuidMap,
      data.initialAddressFieldValues,
      data.capturePhotoProps,
      data.currentLocation,
      data.identifierTypes,
      data.initialIdentifierValues,
      data.currentUser,
      data.config,
      new SavePatientTransactionManager(),
    ),
  ).rejects.toThrow();
  expect(await pending()).toEqual(saved);
});

it('fails before external writes if the queue cannot persist progress', async () => {
  const queued = makeQueued();
  const options = {
    userId: 'synthetic-owner',
    abort: new AbortController(),
    index: 0,
    items: [queued],
    dependencies: [],
    updateContent: vi.fn().mockRejectedValue(new Error('Synthetic storage failure')),
  };
  await expect(syncPatientRegistration(queued, options)).rejects.toThrow();
  expect(savePatient).not.toHaveBeenCalled();
  expect(saveRelationship).not.toHaveBeenCalled();
});

it('keeps generated identifiers across a later rejected generation and reload', async () => {
  const queued = makeQueued();
  const data = queued._patientRegistrationData;
  data.identifierTypes = [
    {
      uuid: 'synthetic-identifier-type',
      name: 'Synthetic identifier',
      fieldName: 'synthetic',
      required: true,
      format: '',
      isPrimary: true,
      uniquenessBehavior: 'UNIQUE',
      locationBehavior: 'NOT_USED',
      identifierSources: [],
    },
  ];
  for (const field of ['first', 'second']) {
    data.formValues.identifiers[field] = {
      identifierTypeUuid: 'synthetic-identifier-type',
      identifierName: 'Synthetic identifier',
      initialValue: '',
      identifierValue: '',
      autoGeneration: true,
      required: true,
      preferred: field === 'first',
      selectedSource: { uuid: 'synthetic-source-' + field, name: 'Synthetic source' },
    };
  }
  vi.mocked(generateIdentifier)
    .mockResolvedValueOnce({ data: { identifier: 'synthetic-first-id' } } as never)
    .mockRejectedValueOnce(rejectedWrite)
    .mockResolvedValueOnce({ data: { identifier: 'synthetic-second-id' } } as never);
  await enqueue(queued);
  await expect(runSynchronization()).rejects.toThrow();
  expect(savePatient).not.toHaveBeenCalled();
  expect((await pending())._patientRegistrationData.savePatientTransactionManager.generatedIdentifiers).toEqual({
    first: 'synthetic-first-id',
  });
  await runSynchronization();
  expect(generateIdentifier).toHaveBeenCalledTimes(3);
  expect(vi.mocked(savePatient).mock.calls[0][0].identifiers.map(({ identifier }) => identifier)).toEqual([
    'synthetic-first-id',
    'synthetic-second-id',
  ]);
});

it('does not bypass an ambiguous queued write by reopening the ordinary online form', async () => {
  const data = makeQueued()._patientRegistrationData;
  data.savePatientTransactionManager.pendingWrites.patient = true;
  await expect(
    FormManager.savePatientFormOnline(
      data.isNewPatient,
      data.formValues,
      data.patientUuidMap,
      data.initialAddressFieldValues,
      data.capturePhotoProps,
      data.currentLocation,
      data.identifierTypes,
      data.initialIdentifierValues,
      data.currentUser,
      data.config,
      data.savePatientTransactionManager,
      new AbortController(),
    ),
  ).rejects.toThrow('requires reconciliation');
  expect(savePatient).not.toHaveBeenCalled();
  expect(saveRelationship).not.toHaveBeenCalled();
});

it('requires durable synchronization when reopening confirmed partial progress online', async () => {
  vi.mocked(saveRelationship).mockRejectedValueOnce(rejectedWrite);
  await enqueue();
  await expect(runSynchronization()).rejects.toThrow();
  const data = (await pending())._patientRegistrationData;
  expect(data.savePatientTransactionManager.pendingWrites).toEqual({});
  await expect(
    FormManager.savePatientFormOnline(
      data.isNewPatient,
      data.formValues,
      data.patientUuidMap,
      data.initialAddressFieldValues,
      data.capturePhotoProps,
      data.currentLocation,
      data.identifierTypes,
      data.initialIdentifierValues,
      data.currentUser,
      data.config,
      data.savePatientTransactionManager,
      new AbortController(),
    ),
  ).rejects.toThrow();
  expect(saveRelationship).toHaveBeenCalledOnce();
  await runSynchronization();
  expect(saveRelationship).toHaveBeenCalledTimes(2);
  expect(savePatient).toHaveBeenCalledOnce();
  expect(await pending()).toBeUndefined();
});

it('requires the item-scoped update capability before synchronizing a queued registration', async () => {
  const queued = makeQueued();
  await expect(
    syncPatientRegistration(queued, {
      userId: 'synthetic-owner',
      abort: new AbortController(),
      index: 0,
      items: [queued],
      dependencies: [],
    }),
  ).rejects.toThrow();
  expect(savePatient).not.toHaveBeenCalled();
});

it('allows correcting a queued registration after its first write was definitively rejected', async () => {
  vi.mocked(savePatient).mockRejectedValueOnce(rejectedWrite);
  await enqueue();
  await expect(runSynchronization()).rejects.toThrow();
  const data = (await pending())._patientRegistrationData;
  data.formValues.givenName = 'Synthetic correction';
  await FormManager.savePatientFormOffline(
    data.isNewPatient,
    data.formValues,
    data.patientUuidMap,
    data.initialAddressFieldValues,
    data.capturePhotoProps,
    data.currentLocation,
    data.identifierTypes,
    data.initialIdentifierValues,
    data.currentUser,
    data.config,
    data.savePatientTransactionManager,
  );
  await runSynchronization();
  expect(savePatient).toHaveBeenCalledTimes(2);
  expect(vi.mocked(savePatient).mock.calls[1][0].person.names[0].givenName).toBe('Synthetic correction');
  expect(await pending()).toBeUndefined();
});

it.each([
  { ok: true, data: {} },
  { ok: true, data: { uuid: 'synthetic-different-patient' } },
  { ok: false, data: {} },
])('does not checkpoint an unconfirmed patient response as completed', async (response) => {
  vi.mocked(savePatient).mockResolvedValueOnce(response as never);
  await enqueue();
  await expect(runSynchronization()).rejects.toThrow();
  expect((await pending())._patientRegistrationData.savePatientTransactionManager.pendingWrites).toEqual({
    patient: true,
  });
  await expect(runSynchronization()).rejects.toThrow();
  expect(savePatient).toHaveBeenCalledOnce();
  expect(saveRelationship).not.toHaveBeenCalled();
});
