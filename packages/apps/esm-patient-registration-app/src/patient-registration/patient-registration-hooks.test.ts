import { getSynchronizationItems, openmrsFetch, usePatient } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';

import { type PatientRegistration } from './patient-registration.types';
import {
  createInitialFormValues,
  mapEncounterObservations,
  useInitialAddressFieldValues,
  useInitialFormValues,
  usePatientUuidMap,
} from './patient-registration-hooks';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getSynchronizationItems: vi.fn(),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(() => ({
    freeTextFieldConceptUuid: 'free-text-concept-uuid',
    registrationObs: { encounterTypeUuid: null },
    relationshipOptions: {},
  })),
  usePatient: vi.fn(),
}));

const mockGetSynchronizationItems = vi.mocked(getSynchronizationItems);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUsePatient = vi.mocked(usePatient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mapEncounterObservations', () => {
  it('returns an empty object when an encounter omits observations', () => {
    expect(mapEncounterObservations(undefined)).toEqual({});
  });

  it('maps coded and plain observation values by concept UUID', () => {
    expect(
      mapEncounterObservations([
        {
          concept: { uuid: 'coded-concept-uuid' },
          value: { uuid: 'coded-value-uuid' },
        },
        {
          concept: { uuid: 'text-concept-uuid' },
          value: 'text value',
        },
      ] as never),
    ).toEqual({
      'coded-concept-uuid': 'coded-value-uuid',
      'text-concept-uuid': 'text value',
    });
  });
});

describe('queued patient registration hydration', () => {
  it('prefers complete queued data over the preliminary FHIR patient', async () => {
    const patientUuid = 'queued-patient-uuid';
    const queuedFormValues = {
      ...createInitialFormValues(),
      patientUuid,
      givenName: 'Nombre guardado en cola',
    };
    const queuedRegistration = {
      fhirPatient: {
        resourceType: 'Patient',
        id: patientUuid,
        name: [{ given: ['Nombre preliminar FHIR'] }],
      },
      _patientRegistrationData: {
        isNewPatient: true,
        formValues: queuedFormValues,
        initialAddressFieldValues: { address: { cityVillage: 'Santa Clotilde' } },
        patientUuidMap: { preferredNameUuid: 'queued-name-uuid' },
      },
    } as unknown as PatientRegistration;

    mockUsePatient.mockReturnValue({
      error: null,
      isLoading: true,
      patient: queuedRegistration.fhirPatient,
    } as ReturnType<typeof usePatient>);
    mockGetSynchronizationItems.mockResolvedValue([queuedRegistration]);

    const { result } = renderHook(() => ({
      address: useInitialAddressFieldValues(patientUuid),
      form: useInitialFormValues(patientUuid),
      uuidMap: usePatientUuidMap(patientUuid),
    }));

    await waitFor(() => {
      expect(result.current.form[2].isLoading).toBe(false);
      expect(result.current.address[2].isLoading).toBe(false);
      expect(result.current.uuidMap[2].isLoading).toBe(false);
    });

    expect(result.current.form[0]).toBe(queuedFormValues);
    expect(result.current.form[2]).toMatchObject({
      isNewPatient: true,
      queuedRegistration,
    });
    expect(result.current.address[0]).toEqual({ address: { cityVillage: 'Santa Clotilde' } });
    expect(result.current.uuidMap[0]).toEqual({ preferredNameUuid: 'queued-name-uuid' });
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
