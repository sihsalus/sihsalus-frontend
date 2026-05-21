import { findPatientsByIdentifier } from '../../api';
import type { PatientIdentifier } from '../../types';

import { hasDuplicatePatientIdentifiers } from './encounter-processor-helper';

vi.mock('../../api', () => ({
  findPatientsByIdentifier: vi.fn(),
}));

const mockFindPatientsByIdentifier = vi.mocked(findPatientsByIdentifier);

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
