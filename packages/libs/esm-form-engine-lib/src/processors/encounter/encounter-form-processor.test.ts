import { FormSubmissionError } from '../../utils/error-utils';

import { EncounterFormProcessor } from './encounter-form-processor';

const mockGetMutableSessionProps = vi.fn();
const mockPreparePatientIdentifiers = vi.fn();
const mockHasDuplicatePatientIdentifiers = vi.fn();
const mockPrepareEncounter = vi.fn();
const mockSaveEncounter = vi.fn();

vi.mock('@openmrs/esm-framework', () => ({
  showSnackbar: vi.fn(),
  translateFrom: (_appName: string, _key: string, defaultValue: string): string => defaultValue,
}));

vi.mock('../../api', () => ({
  getPreviousEncounter: vi.fn(),
  saveEncounter: (...args: Array<unknown>): unknown => mockSaveEncounter(...args),
}));

vi.mock('./encounter-processor-helper', () => ({
  getMutableSessionProps: (...args: Array<unknown>): unknown => mockGetMutableSessionProps(...args),
  hasDuplicatePatientIdentifiers: (...args: Array<unknown>): unknown => mockHasDuplicatePatientIdentifiers(...args),
  hydrateRepeatField: vi.fn(),
  inferInitialValueFromDefaultFieldValue: vi.fn(),
  prepareEncounter: (...args: Array<unknown>): unknown => mockPrepareEncounter(...args),
  preparePatientIdentifiers: (...args: Array<unknown>): unknown => mockPreparePatientIdentifiers(...args),
  preparePersonAttributes: vi.fn(() => []),
  preparePatientPrograms: vi.fn(() => []),
  saveAttachments: vi.fn(() => []),
  savePatientIdentifiers: vi.fn(() => []),
  savePersonAttributes: vi.fn(() => []),
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
    mockPrepareEncounter.mockResolvedValue({ uuid: 'encounter-uuid', orders: [], diagnoses: [] });
    mockSaveEncounter.mockResolvedValue({
      data: { uuid: 'encounter-uuid', orders: [], diagnoses: [] },
    });
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

  it('runs the final pre-save callback with the prepared payload immediately before saving the encounter', async () => {
    const processor = new EncounterFormProcessor({ uuid: 'form-uuid', pages: [] } as never);
    const abortController = new AbortController();
    const preparedEncounter = {
      patient: 'patient-uuid',
      visit: { patient: 'patient-uuid' },
      orders: [],
      diagnoses: [],
    };
    const onBeforeEncounterSave = vi.fn().mockResolvedValue(undefined);
    mockPrepareEncounter.mockResolvedValue(preparedEncounter);

    await processor.processSubmission(
      {
        patient: { id: 'patient-uuid' } as fhir.Patient,
        formFields: [],
        onBeforeEncounterSave,
      } as never,
      abortController,
    );

    expect(onBeforeEncounterSave).toHaveBeenCalledOnce();
    expect(onBeforeEncounterSave).toHaveBeenCalledWith(preparedEncounter);
    expect(mockSaveEncounter).toHaveBeenCalledWith(abortController, preparedEncounter, undefined);
    expect(onBeforeEncounterSave.mock.invocationCallOrder[0]).toBeLessThan(mockSaveEncounter.mock.invocationCallOrder[0]);
  });

  it('does not save the encounter when the final pre-save callback rejects', async () => {
    const processor = new EncounterFormProcessor({ uuid: 'form-uuid', pages: [] } as never);
    const abortController = new AbortController();
    const preparedEncounter = {
      patient: 'patient-uuid',
      visit: { patient: 'patient-uuid' },
      orders: [],
      diagnoses: [],
    };
    const onBeforeEncounterSave = vi.fn().mockRejectedValue(new Error('Patient vital status unavailable'));
    mockPrepareEncounter.mockResolvedValue(preparedEncounter);

    const submissionPromise = processor.processSubmission(
      {
        patient: { id: 'patient-uuid' } as fhir.Patient,
        formFields: [],
        onBeforeEncounterSave,
      } as never,
      abortController,
    );

    await expect(submissionPromise).rejects.toBeInstanceOf(FormSubmissionError);
    expect(onBeforeEncounterSave).toHaveBeenCalledWith(preparedEncounter);
    expect(mockSaveEncounter).not.toHaveBeenCalled();
  });
});
