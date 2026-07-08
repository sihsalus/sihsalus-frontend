import { findPatientsByIdentifier } from '../../api';
import type { FormContextProps } from '../../provider/form-provider';
import type { OpenmrsEncounter, PatientIdentifier } from '../../types';
import type { FormField } from '../../types/schema';

import { getMutableSessionProps, hasDuplicatePatientIdentifiers, prepareEncounter } from './encounter-processor-helper';

vi.mock('../../api', () => ({
  findPatientsByIdentifier: vi.fn(),
}));

const mockFindPatientsByIdentifier = vi.mocked(findPatientsByIdentifier);

const createSubmissionField = (type: FormField['type'], newValue: unknown): FormField =>
  ({
    type,
    meta: {
      submission: {
        newValue,
      },
    },
  }) as FormField;

const createFormContext = (overrides: Partial<FormContextProps> = {}): FormContextProps =>
  ({
    patient: { id: 'patient-uuid' },
    formJson: {
      uuid: 'form-uuid',
      encounterType: 'encounter-type-uuid',
    },
    formFields: [],
    deletedFields: [],
    visit: { uuid: 'visit-uuid' },
    sessionDate: new Date('2024-02-03T10:30:00.000Z'),
    location: { uuid: 'location-uuid' },
    currentProvider: { uuid: 'provider-uuid' },
    customDependencies: {
      defaultEncounterRole: { uuid: 'encounter-role-uuid' },
    },
    ...overrides,
  }) as FormContextProps;

describe('hasDuplicatePatientIdentifiers', () => {
  const patient = { id: 'current-patient-uuid' } as fhir.Patient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when the submission contains the same identifier twice', async () => {
    const identifiers: PatientIdentifier[] = [
      { identifier: 'ABC123', identifierType: 'type-1' },
      { identifier: 'ABC123', identifierType: 'type-1' },
    ];

    await expect(hasDuplicatePatientIdentifiers(patient, identifiers)).resolves.toBe(true);
    expect(mockFindPatientsByIdentifier).not.toHaveBeenCalled();
  });

  it('returns true when another patient already has the same identifier and type', async () => {
    mockFindPatientsByIdentifier.mockResolvedValue([
      {
        uuid: 'other-patient-uuid',
        identifiers: [{ identifier: 'ABC123', identifierType: { uuid: 'type-1' } }],
      },
    ]);

    await expect(
      hasDuplicatePatientIdentifiers(patient, [{ identifier: 'ABC123', identifierType: 'type-1' }]),
    ).resolves.toBe(true);
  });

  it('returns false when the only matching identifier belongs to the current patient', async () => {
    mockFindPatientsByIdentifier.mockResolvedValue([
      {
        uuid: 'current-patient-uuid',
        identifiers: [{ identifier: 'ABC123', identifierType: { uuid: 'type-1' } }],
      },
    ]);

    await expect(
      hasDuplicatePatientIdentifiers(patient, [{ identifier: 'ABC123', identifierType: 'type-1' }]),
    ).resolves.toBe(false);
  });

  it('returns false when the duplicate lookup fails', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFindPatientsByIdentifier.mockRejectedValue(new Error('lookup failed'));

    await expect(
      hasDuplicatePatientIdentifiers(patient, [{ identifier: 'ABC123', identifierType: 'type-1' }]),
    ).resolves.toBe(false);

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});

describe('getMutableSessionProps', () => {
  it('does not default active visits to the client clock when no encounter datetime was submitted', () => {
    const context = createFormContext({
      visit: { uuid: 'active-visit-uuid' } as never,
    });

    expect(getMutableSessionProps(context).encounterDate).toBeUndefined();
  });

  it('uses the session date for stopped visits when no encounter datetime was submitted', () => {
    const sessionDate = new Date('2024-02-03T10:30:00.000Z');
    const context = createFormContext({
      sessionDate,
      visit: { uuid: 'stopped-visit-uuid', stopDatetime: '2024-02-03T12:00:00.000Z' } as never,
    });

    expect(getMutableSessionProps(context).encounterDate).toBe(sessionDate);
  });

  it('uses an explicitly submitted encounter datetime before visit defaults', () => {
    const submittedEncounterDate = new Date('2024-02-03T09:00:00.000Z');
    const context = createFormContext({
      formFields: [createSubmissionField('encounterDatetime', submittedEncounterDate)],
      visit: { uuid: 'stopped-visit-uuid', stopDatetime: '2024-02-03T12:00:00.000Z' } as never,
    });

    expect(getMutableSessionProps(context).encounterDate).toBe(submittedEncounterDate);
  });
});

describe('prepareEncounter', () => {
  it('omits encounterDatetime when no safe date is available', async () => {
    const encounter = await prepareEncounter(
      createFormContext(),
      undefined,
      'encounter-role-uuid',
      'provider-uuid',
      'location-uuid',
    );

    expect(encounter.encounterDatetime).toBeUndefined();
  });

  it('includes encounterDatetime when a safe date is provided', async () => {
    const encounterDate = new Date('2024-02-03T10:30:00.000Z');
    const encounter = await prepareEncounter(
      createFormContext(),
      encounterDate,
      'encounter-role-uuid',
      'provider-uuid',
      'location-uuid',
    );

    expect(encounter.encounterDatetime).toBe(encounterDate);
  });

  it('preserves an existing encounter datetime when no new date is submitted', async () => {
    const existingEncounter = {
      uuid: 'encounter-uuid',
      encounterDatetime: new Date('2024-02-02T10:30:00.000Z'),
      encounterProviders: [],
    } as OpenmrsEncounter;

    const encounter = await prepareEncounter(
      createFormContext({ domainObjectValue: existingEncounter as never }),
      undefined,
      'encounter-role-uuid',
      'provider-uuid',
      'location-uuid',
    );

    expect(encounter.encounterDatetime).toBe(existingEncounter.encounterDatetime);
  });
});
