import { renderHook, waitFor } from "@testing-library/react";

import { FormSubmissionError } from "../../utils/error-utils";

import { EncounterFormProcessor } from "./encounter-form-processor";

const mockGetMutableSessionProps = vi.fn();
const mockPreparePatientIdentifiers = vi.fn();
const mockHasDuplicatePatientIdentifiers = vi.fn();
const mockPrepareEncounter = vi.fn();
const mockSaveEncounter = vi.fn();
const mockUseEncounter = vi.fn();
const mockUseEncounterRole = vi.fn();
const mockUsePatientPrograms = vi.fn();

vi.mock("@openmrs/esm-framework", () => ({
  showSnackbar: vi.fn(),
  translateFrom: (
    _appName: string,
    _key: string,
    defaultValue: string,
  ): string => defaultValue,
}));

vi.mock("../../api", () => ({
  getPreviousEncounter: vi.fn(),
  saveEncounter: (...args: Array<unknown>): unknown =>
    mockSaveEncounter(...args),
}));

vi.mock("../../hooks/useEncounter", () => ({
  useEncounter: (...args: Array<unknown>): unknown => mockUseEncounter(...args),
}));

vi.mock("../../hooks/useEncounterRole", () => ({
  useEncounterRole: (...args: Array<unknown>): unknown =>
    mockUseEncounterRole(...args),
}));

vi.mock("../../hooks/usePatientPrograms", () => ({
  usePatientPrograms: (...args: Array<unknown>): unknown =>
    mockUsePatientPrograms(...args),
}));

vi.mock("./encounter-processor-helper", () => ({
  getMutableSessionProps: (...args: Array<unknown>): unknown =>
    mockGetMutableSessionProps(...args),
  hasDuplicatePatientIdentifiers: (...args: Array<unknown>): unknown =>
    mockHasDuplicatePatientIdentifiers(...args),
  hydrateRepeatField: vi.fn(),
  inferInitialValueFromDefaultFieldValue: vi.fn(),
  prepareEncounter: (...args: Array<unknown>): unknown =>
    mockPrepareEncounter(...args),
  preparePatientIdentifiers: (...args: Array<unknown>): unknown =>
    mockPreparePatientIdentifiers(...args),
  preparePersonAttributes: vi.fn(() => []),
  preparePatientPrograms: vi.fn(() => []),
  saveAttachments: vi.fn(() => []),
  savePatientIdentifiers: vi.fn(() => []),
  savePersonAttributes: vi.fn(() => []),
  savePatientPrograms: vi.fn(() => []),
}));

describe("EncounterFormProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMutableSessionProps.mockReturnValue({
      encounterRole: "encounter-role-uuid",
      encounterProvider: "provider-uuid",
      encounterDate: new Date("2024-01-01T10:00:00.000Z"),
      encounterLocation: "location-uuid",
    });
    mockPreparePatientIdentifiers.mockReturnValue([
      { identifier: "ABC123", identifierType: "type-1" },
    ]);
    mockHasDuplicatePatientIdentifiers.mockResolvedValue(false);
    mockPrepareEncounter.mockResolvedValue({
      uuid: "encounter-uuid",
      orders: [],
      diagnoses: [],
    });
    mockSaveEncounter.mockResolvedValue({
      data: { uuid: "encounter-uuid", orders: [], diagnoses: [] },
    });
    mockUseEncounter.mockReturnValue({
      encounter: null,
      error: null,
      isLoading: false,
    });
    mockUseEncounterRole.mockReturnValue({
      encounterRole: { uuid: "encounter-role-uuid" },
      isLoading: false,
    });
    mockUsePatientPrograms.mockReturnValue({
      isLoadingPatientPrograms: false,
      patientPrograms: [],
    });
  });

  it("propagates a forbidden encounter load and blocks edit submission before save", async () => {
    const forbiddenError = Object.assign(new Error("Forbidden"), {
      status: 403,
    });
    const processor = new EncounterFormProcessor({
      uuid: "form-uuid",
      pages: [],
    } as never);
    mockUseEncounter.mockReturnValue({
      encounter: null,
      error: forbiddenError,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      processor.getCustomHooks().useCustomHooks({
        formJson: { encounter: "encounter-uuid" },
        patient: { id: "patient-uuid" },
      } as never),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(forbiddenError);

    const submissionPromise = processor.processSubmission(
      {
        domainObjectValue: undefined,
        patient: { id: "patient-uuid" } as fhir.Patient,
        formJson: { encounter: "encounter-uuid" },
        formFields: [],
        sessionMode: "edit",
      } as never,
      new AbortController(),
    );

    await expect(submissionPromise).rejects.toBeInstanceOf(FormSubmissionError);
    await expect(submissionPromise).rejects.toMatchObject({
      descriptor: expect.objectContaining({
        title: "The existing clinical record could not be loaded",
      }),
    });
    expect(mockGetMutableSessionProps).not.toHaveBeenCalled();
    expect(mockPrepareEncounter).not.toHaveBeenCalled();
    expect(mockSaveEncounter).not.toHaveBeenCalled();
  });

  it("allows an edit only when the loaded encounter matches the requested encounter", async () => {
    const processor = new EncounterFormProcessor({
      uuid: "form-uuid",
      pages: [],
    } as never);
    const abortController = new AbortController();

    await processor.processSubmission(
      {
        domainObjectValue: {
          uuid: "encounter-uuid",
          patient: { uuid: "patient-uuid" },
          form: { uuid: "form-uuid" },
          visit: { uuid: "visit-uuid" },
        },
        patient: { id: "patient-uuid" } as fhir.Patient,
        formJson: { encounter: "encounter-uuid", uuid: "form-uuid" },
        visit: { uuid: "visit-uuid" },
        formFields: [],
        sessionMode: "edit",
      } as never,
      abortController,
    );

    expect(mockPrepareEncounter).toHaveBeenCalledOnce();
    expect(mockSaveEncounter).toHaveBeenCalledWith(
      abortController,
      expect.objectContaining({ uuid: "encounter-uuid" }),
      "encounter-uuid",
    );
  });

  it.each([
    ["patient", { patient: { uuid: "another-patient" } }],
    ["form", { form: { uuid: "another-form" } }],
    ["visit", { visit: { uuid: "another-visit" } }],
  ])("blocks an edit before side effects when the loaded %s identity differs", async (_field, override) => {
    const processor = new EncounterFormProcessor({ uuid: "form-uuid", pages: [] } as never);
    const domainObjectValue = {
      uuid: "encounter-uuid",
      patient: { uuid: "patient-uuid" },
      form: { uuid: "form-uuid" },
      visit: { uuid: "visit-uuid" },
      ...override,
    };

    await expect(
      processor.processSubmission(
        {
          domainObjectValue,
          patient: { id: "patient-uuid" } as fhir.Patient,
          formJson: { encounter: "encounter-uuid", uuid: "form-uuid" },
          formFields: [],
          sessionMode: "edit",
          visit: { uuid: "visit-uuid" },
        } as never,
        new AbortController(),
      ),
    ).rejects.toBeInstanceOf(FormSubmissionError);
    expect(mockPrepareEncounter).not.toHaveBeenCalled();
    expect(mockSaveEncounter).not.toHaveBeenCalled();
  });

  it("rejects edit mode when no encounter was requested or loaded", async () => {
    const processor = new EncounterFormProcessor({
      uuid: "form-uuid",
      pages: [],
    } as never);

    const submissionPromise = processor.processSubmission(
      {
        domainObjectValue: undefined,
        patient: { id: "patient-uuid" } as fhir.Patient,
        formJson: { uuid: "form-uuid" },
        formFields: [],
        sessionMode: "edit",
      } as never,
      new AbortController(),
    );

    await expect(submissionPromise).rejects.toBeInstanceOf(FormSubmissionError);
    expect(mockGetMutableSessionProps).not.toHaveBeenCalled();
    expect(mockPrepareEncounter).not.toHaveBeenCalled();
    expect(mockSaveEncounter).not.toHaveBeenCalled();
  });

  it("blocks submission before encounter save when duplicate patient identifiers are detected", async () => {
    const processor = new EncounterFormProcessor({
      uuid: "form-uuid",
      pages: [],
    } as never);
    const abortController = new AbortController();

    mockHasDuplicatePatientIdentifiers.mockResolvedValue(true);

    const submissionPromise = processor.processSubmission(
      {
        patient: { id: "patient-uuid" } as fhir.Patient,
        formFields: [],
      } as never,
      abortController,
    );

    await expect(submissionPromise).rejects.toBeInstanceOf(FormSubmissionError);
    await expect(submissionPromise).rejects.toMatchObject({
      descriptor: expect.objectContaining({
        title: "Patient identifier duplication",
      }),
    });

    expect(mockPrepareEncounter).not.toHaveBeenCalled();
  });

  it("runs the final pre-save callback with the prepared payload immediately before saving the encounter", async () => {
    const processor = new EncounterFormProcessor({
      uuid: "form-uuid",
      pages: [],
    } as never);
    const abortController = new AbortController();
    const preparedEncounter = {
      patient: "patient-uuid",
      visit: { patient: "patient-uuid" },
      orders: [],
      diagnoses: [],
    };
    const onBeforeEncounterSave = vi.fn().mockResolvedValue(undefined);
    mockPrepareEncounter.mockResolvedValue(preparedEncounter);

    await processor.processSubmission(
      {
        patient: { id: "patient-uuid" } as fhir.Patient,
        formFields: [],
        onBeforeEncounterSave,
      } as never,
      abortController,
    );

    expect(onBeforeEncounterSave).toHaveBeenCalledOnce();
    expect(onBeforeEncounterSave).toHaveBeenCalledWith(preparedEncounter);
    expect(mockSaveEncounter).toHaveBeenCalledWith(
      abortController,
      preparedEncounter,
      undefined,
    );
    expect(onBeforeEncounterSave.mock.invocationCallOrder[0]).toBeLessThan(
      mockSaveEncounter.mock.invocationCallOrder[0],
    );
  });

  it("does not save the encounter when the final pre-save callback rejects", async () => {
    const processor = new EncounterFormProcessor({
      uuid: "form-uuid",
      pages: [],
    } as never);
    const abortController = new AbortController();
    const preparedEncounter = {
      patient: "patient-uuid",
      visit: { patient: "patient-uuid" },
      orders: [],
      diagnoses: [],
    };
    const onBeforeEncounterSave = vi
      .fn()
      .mockRejectedValue(new Error("Patient vital status unavailable"));
    mockPrepareEncounter.mockResolvedValue(preparedEncounter);

    const submissionPromise = processor.processSubmission(
      {
        patient: { id: "patient-uuid" } as fhir.Patient,
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
