import { FormSubmissionError } from '../../utils/error-utils';

import { EncounterFormProcessor } from './encounter-form-processor';

const mockGetMutableSessionProps = vi.fn();
const mockPreparePatientIdentifiers = vi.fn();
const mockHasDuplicatePatientIdentifiers = vi.fn();
const mockPrepareEncounter = vi.fn();

vi.mock('@openmrs/esm-framework', () => ({
  showSnackbar: vi.fn(),
  translateFrom: (_appName: string, _key: string, defaultValue: string): string => defaultValue,
}));

vi.mock('./encounter-processor-helper', () => ({
  getMutableSessionProps: (...args: Array<unknown>): unknown => mockGetMutableSessionProps(...args),
  hasDuplicatePatientIdentifiers: (...args: Array<unknown>): unknown => mockHasDuplicatePatientIdentifiers(...args),
  hydrateRepeatField: vi.fn(),
  inferInitialValueFromDefaultFieldValue: vi.fn(),
  prepareEncounter: (...args: Array<unknown>): unknown => mockPrepareEncounter(...args),
  preparePatientIdentifiers: (...args: Array<unknown>): unknown => mockPreparePatientIdentifiers(...args),
  preparePatientPrograms: vi.fn(() => []),
  saveAttachments: vi.fn(() => []),
  savePatientIdentifiers: vi.fn(() => []),
  savePatientPrograms: vi.fn(() => []),
}));

describe('EncounterFormProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMutableSessionProps.mockReturnValue({
      encounterRole: 'encounter-role-uuid',
      encounterProvider: 'provider-uuid',
      encounterDate: new Date('2024-01-01T10:00:00.000Z'),
      encounterLocation: 'location-uuid',
    });
    mockPreparePatientIdentifiers.mockReturnValue([{ identifier: 'ABC123', identifierType: 'type-1' }]);
    mockHasDuplicatePatientIdentifiers.mockResolvedValue(false);
    mockPrepareEncounter.mockResolvedValue({ uuid: 'encounter-uuid' });
  });

  it('blocks submission before encounter save when duplicate patient identifiers are detected', async () => {
    const processor = new EncounterFormProcessor({ uuid: 'form-uuid', pages: [] } as never);
    const abortController = new AbortController();

    mockHasDuplicatePatientIdentifiers.mockResolvedValue(true);

    const submissionPromise = processor.processSubmission(
      {
        patient: { id: 'patient-uuid' } as fhir.Patient,
        formFields: [],
      } as never,
      abortController,
    );

    await expect(submissionPromise).rejects.toBeInstanceOf(FormSubmissionError);
    await expect(submissionPromise).rejects.toMatchObject({
      descriptor: expect.objectContaining({
        title: 'Patient identifier duplication',
      }),
    });

    expect(mockPrepareEncounter).not.toHaveBeenCalled();
  });
});
