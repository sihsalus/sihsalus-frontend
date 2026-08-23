import {
  getDefaultsFromConfigSchema,
  showSnackbar,
  userHasAccess,
  useConfig,
  useSession,
} from "@openmrs/esm-framework";
import dayjs from "dayjs";
import { type PatientWorkspace2DefinitionProps } from "@openmrs/esm-patient-common-lib";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ConfigMock,
  diagnosisSearchResponse,
  getByTextWithMarkup,
  mockFetchLocationByUuidResponse,
  mockFetchProviderByUuidResponse,
  mockPatient,
  mockSessionDataResponse,
} from "test-utils";
import { type ConfigObject, configSchema } from "../config-schema";
import { defaultVisitNoteClinicalConceptUuids } from "./visit-note-config-schema";
import {
  assertCanonicalVisitNoteCanBeCreated,
  deletePatientDiagnosis,
  fetchDiagnosisConceptsByName,
  fetchPrestacionalConceptsByName,
  savePatientDiagnosis,
  saveVisitNote,
  updateVisitNote,
  useCanonicalVisitNoteEncounter,
  useProviderSignatureDetails,
  useVisitNoteClinicalContext,
} from "./visit-notes.resource";
import VisitNotesForm, {
  type EditableVisitNoteEncounter,
  getSubmittedEncounterDatetime,
  type VisitNotesFormProps,
} from "./visit-notes-form.workspace";

const defaultProps: PatientWorkspace2DefinitionProps<VisitNotesFormProps, {}> =
  {
    closeWorkspace: vi.fn(),
    workspaceProps: {
      formContext: "creating" as const,
    },
    groupProps: {
      patient: mockPatient as unknown as fhir.Patient,
      patientUuid: mockPatient.id,
      visitContext: {
        uuid: "active-visit-uuid",
        location: {
          uuid: "operational-location-uuid",
          display: "UPSS - CONSULTA EXTERNA",
        },
      } as never,
      mutateVisitContext: null,
    },
    launchChildWorkspace: vi.fn(),
    windowProps: {},
    workspaceName: "",
    windowName: "",
    isRootWorkspace: false,
    showActionMenu: true,
  };

function renderVisitNotesForm(
  workspaceProps: Partial<VisitNotesFormProps> = {},
  groupProps: Partial<typeof defaultProps.groupProps> = {},
) {
  const requestedEncounter = workspaceProps.encounter;
  mockUseCanonicalVisitNoteEncounter.mockReturnValue({
    status: "ready",
    encounter:
      workspaceProps.formContext === "editing" && requestedEncounter
        ? ({
            ...requestedEncounter,
            uuid: requestedEncounter.uuid ?? requestedEncounter.id,
            encounterDatetime:
              requestedEncounter.encounterDatetime ??
              requestedEncounter.rawDatetime,
          } as never)
        : null,
    mutate: vi.fn(),
  });
  const props = {
    ...defaultProps,
    workspaceProps: { ...defaultProps.workspaceProps, ...workspaceProps },
    groupProps: { ...defaultProps.groupProps, ...groupProps },
  };
  render(<VisitNotesForm {...props} />);
}

const mockFetchDiagnosisConceptsByName = vi.mocked(
  fetchDiagnosisConceptsByName,
);
const mockAssertCanonicalVisitNoteCanBeCreated = vi.mocked(
  assertCanonicalVisitNoteCanBeCreated,
);
const mockFetchPrestacionalConceptsByName = vi.mocked(
  fetchPrestacionalConceptsByName,
);
const mockDeletePatientDiagnosis = vi.mocked(deletePatientDiagnosis);
const mockSavePatientDiagnosis = vi.mocked(savePatientDiagnosis);
const mockSaveVisitNote = vi.mocked(saveVisitNote);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUpdateVisitNote = vi.mocked(updateVisitNote);
const mockUseCanonicalVisitNoteEncounter = vi.mocked(
  useCanonicalVisitNoteEncounter,
);
const mockUseProviderSignatureDetails = vi.mocked(useProviderSignatureDetails);
const mockUseVisitNoteClinicalContext = vi.mocked(useVisitNoteClinicalContext);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

const getMockConfig = (overrides: Partial<ConfigObject> = {}): ConfigObject => {
  const defaults = getDefaultsFromConfigSchema(configSchema);
  return {
    ...defaults,
    ...ConfigMock,
    ...overrides,
    visitNoteConfig: {
      ...defaultVisitNoteClinicalConceptUuids,
      ...defaults.visitNoteConfig,
      ...ConfigMock.visitNoteConfig,
      ...overrides.visitNoteConfig,
    },
  } as ConfigObject;
};

vi.mock("lodash-es/debounce", () => ({ default: vi.fn((fn) => fn) }));

vi.mock("./visit-notes.resource", async () => ({
  // Pure P/D/R mapping helpers carry no side effects — use the real ones.
  ...(await vi.importActual<typeof import("./visit-notes.resource")>(
    "./visit-notes.resource",
  )),
  fetchDiagnosisConceptsByName: vi.fn(),
  assertCanonicalVisitNoteCanBeCreated: vi.fn(),
  fetchPrestacionalConceptsByName: vi.fn(),
  deletePatientDiagnosis: vi.fn(),
  savePatientDiagnosis: vi.fn(),
  updateVisitNote: vi.fn(),
  useCanonicalVisitNoteEncounter: vi.fn(),
  useLocationUuid: vi.fn().mockImplementation(() => ({
    data: mockFetchLocationByUuidResponse.data.uuid,
  })),
  useProviderUuid: vi.fn().mockImplementation(() => ({
    data: mockFetchProviderByUuidResponse.data.uuid,
  })),
  saveVisitNote: vi.fn(),
  useProviderSignatureDetails: vi.fn().mockImplementation(() => ({
    providerSignatureDetails: {
      name: "Test Provider",
      professionalRegistration: "CMP-12345",
    },
  })),
  useVisitNoteClinicalContext: vi.fn().mockImplementation(() => ({
    clinicalContext: {},
  })),
  useVisitNotes: vi.fn().mockImplementation(() => ({
    mutateVisitNotes: vi.fn(),
  })),
}));

mockUseSession.mockReturnValue(mockSessionDataResponse.data);
mockUseConfig.mockReturnValue(getMockConfig());

beforeEach(() => {
  vi.clearAllMocks();
  mockUserHasAccess.mockReturnValue(true);
  mockUseSession.mockReturnValue(mockSessionDataResponse.data);
  mockUseConfig.mockReturnValue(getMockConfig());
  mockFetchDiagnosisConceptsByName.mockResolvedValue([]);
  mockAssertCanonicalVisitNoteCanBeCreated.mockResolvedValue();
  mockFetchPrestacionalConceptsByName.mockResolvedValue([]);
  mockUseProviderSignatureDetails.mockReturnValue({
    providerSignatureDetails: {
      name: "Test Provider",
      professionalRegistration: "CMP-12345",
    },
    error: undefined,
    isLoading: false,
  });
  mockUseVisitNoteClinicalContext.mockReturnValue({
    clinicalContext: {},
    error: undefined,
    isLoading: false,
    isValidating: false,
  });
  mockUseCanonicalVisitNoteEncounter.mockReturnValue({
    status: "ready",
    encounter: null,
    mutate: vi.fn(),
  });
});

test("delegates the default current encounter time to the server and preserves an explicitly selected date", () => {
  const selectedDate = new Date("2026-07-01T09:15:00.000-05:00");

  expect(getSubmittedEncounterDatetime(selectedDate, false)).toBeUndefined();
  expect(getSubmittedEncounterDatetime(selectedDate, true)).toContain(
    "2026-07-01",
  );
});

test("keeps the time of day when the date-only picker resolves to midnight", () => {
  // OpenmrsDatePicker is date-only: picking a day yields local midnight.
  const pickedToday = new Date(2026, 6, 1, 0, 0, 0, 0);
  const now = new Date(2026, 6, 1, 14, 32, 5, 0);

  const submitted = getSubmittedEncounterDatetime(pickedToday, true, now);

  expect(submitted).toContain("2026-07-01");
  expect(dayjs(submitted).hour()).toBe(14);
  expect(dayjs(submitted).minute()).toBe(32);
});

test("submits an encounter datetime inside a visit that started earlier the same day", () => {
  const visitStart = new Date(2026, 6, 1, 8, 30, 0, 0);
  const pickedToday = new Date(2026, 6, 1, 0, 0, 0, 0);
  const now = new Date(2026, 6, 1, 10, 0, 0, 0);

  const submitted = getSubmittedEncounterDatetime(pickedToday, true, now);

  expect(dayjs(submitted).isAfter(visitStart)).toBe(true);
});

test("closes the visit summary workspace when its edit privilege is denied", async () => {
  const closeWorkspace = vi.fn();
  mockUserHasAccess.mockReturnValue(false);

  render(<VisitNotesForm {...defaultProps} closeWorkspace={closeWorkspace} />);

  expect(screen.queryByText(/visit note/i)).not.toBeInTheDocument();
  await waitFor(() =>
    expect(closeWorkspace).toHaveBeenCalledWith({
      closeWindow: true,
      discardUnsavedChanges: true,
    }),
  );
  expect(mockUserHasAccess).toHaveBeenCalledWith(
    "app:hoja.clinica.resumenConsulta.editar",
    expect.anything(),
  );
});

test("fails closed while the canonical visit summary cannot be verified", () => {
  mockUseCanonicalVisitNoteEncounter.mockReturnValue({
    status: "error",
    encounter: null,
    mutate: vi.fn(),
  });

  render(<VisitNotesForm {...defaultProps} />);

  expect(
    screen.getByText(/visit summary cannot be opened/i),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /save and close/i }),
  ).not.toBeInTheDocument();
});

test("fails closed when the active visit has duplicate canonical summaries", () => {
  mockUseCanonicalVisitNoteEncounter.mockReturnValue({
    status: "ambiguous",
    encounter: null,
    mutate: vi.fn(),
  });

  render(<VisitNotesForm {...defaultProps} />);

  expect(screen.getByText(/more than one summary exists/i)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /save and close/i }),
  ).not.toBeInTheDocument();
});

test("renders the visit notes form with all the relevant fields and values", () => {
  mockFetchDiagnosisConceptsByName.mockResolvedValue([]);

  renderVisitNotesForm();

  expect(screen.getByLabelText(/visit date/i)).toBeInTheDocument();
  expect(screen.getByText(/Test Provider/i)).toBeInTheDocument();
  expect(screen.getByText(/CMP-12345/i)).toBeInTheDocument();
  expect(
    screen.getByRole("textbox", { name: /chief complaint/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("textbox", { name: /objective \/ physical exam/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("textbox", { name: /additional notes/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("searchbox", { name: /enter primary diagnoses/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("searchbox", { name: /enter secondary diagnoses/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("searchbox", { name: /indique el código prestacional/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /add image/i }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /save and close/i }),
  ).toBeInTheDocument();
});

test("prefills normative fields from saved clinical context", async () => {
  mockUseVisitNoteClinicalContext.mockReturnValue({
    clinicalContext: {
      chiefComplaint: "Fever and cough",
      biologicalFunctions: "Appetite: decreased",
      plan: "Hydration and follow-up",
    },
    error: undefined,
    isLoading: false,
    isValidating: false,
  });

  renderVisitNotesForm();

  await waitFor(() =>
    expect(
      screen.getByRole("textbox", { name: /chief complaint/i }),
    ).toHaveValue("Fever and cough"),
  );
  expect(
    screen.getByRole("textbox", { name: /biological functions/i }),
  ).toHaveValue("Appetite: decreased");
  expect(screen.getByRole("textbox", { name: /treatment plan/i })).toHaveValue(
    "Hydration and follow-up",
  );
});

test("typing in the diagnosis search input triggers a search", async () => {
  const user = userEvent.setup();

  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );

  renderVisitNotesForm();

  const searchBox = screen.getByPlaceholderText("Choose a primary diagnosis");
  await user.type(searchBox, "Diabetes Mellitus");

  // Wait for the search results to appear
  const targetSearchResult = await screen.findByRole("button", {
    name: "Diabetes Mellitus",
  });
  expect(targetSearchResult).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Diabetes Mellitus, Type II" }),
  ).toBeInTheDocument();

  // clicking on a search result displays the selected diagnosis as a tag
  await user.click(targetSearchResult);
  expect(screen.getByTitle("Diabetes Mellitus")).toBeInTheDocument();
  const diabetesMellitusTag = screen.getByTitle(/^Diabetes Mellitus$/i);
  expect(diabetesMellitusTag).toBeInTheDocument();

  const closeTagButton = screen.getByRole("button", { name: /clear filter/i });
  // Clicking the close button on the tag removes the selected diagnosis
  await user.click(closeTagButton);
  // no selected diagnoses left
  expect(
    screen.getByText(/No diagnosis selected — Enter a diagnosis below/i),
  ).toBeInTheDocument();
});

test("formats CIE-10 diagnosis search results and selected tags for readability", async () => {
  const user = userEvent.setup();

  mockFetchDiagnosisConceptsByName.mockResolvedValue([
    {
      uuid: "cie10-f155",
      display:
        "TRASTORNOS MENTALES Y DEL COMPORTAMIENTO DEBIDOS AL USO DE OTROS ESTIMULANTES INCLUIDA (F155)",
    },
  ]);

  renderVisitNotesForm();

  const searchBox = screen.getByPlaceholderText("Choose a primary diagnosis");
  await user.type(searchBox, "f");

  const formattedDiagnosis =
    "F155 - Trastornos mentales y del comportamiento debidos al uso de otros estimulantes incluida";
  const diagnosisOption = await screen.findByRole("button", {
    name: formattedDiagnosis,
  });
  expect(diagnosisOption).toBeInTheDocument();

  await user.click(diagnosisOption);

  expect(screen.getByTitle(formattedDiagnosis)).toBeInTheDocument();
});

test("renders an error message when no matching diagnoses are found", async () => {
  const user = userEvent.setup();
  mockFetchDiagnosisConceptsByName.mockResolvedValue([]);

  renderVisitNotesForm();

  const searchBox = screen.getByPlaceholderText("Choose a primary diagnosis");
  await user.type(searchBox, "COVID-21");

  await screen.findByText(/No diagnoses found/i);
  expect(
    getByTextWithMarkup('No diagnoses found matching "COVID-21"'),
  ).toBeInTheDocument();
});

test("searches and saves one selected codigo prestacional concept", async () => {
  const user = userEvent.setup();

  mockUseConfig.mockReturnValue(
    getMockConfig({ prestacionalConceptSourceName: "Codigos Prestacionales" }),
  );
  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );
  mockFetchPrestacionalConceptsByName.mockResolvedValue([
    { uuid: "prestacional-001", display: "001 - Consulta externa" },
    { uuid: "prestacional-002", display: "002 - Control ambulatorio" },
  ]);
  mockSaveVisitNote.mockResolvedValueOnce({
    status: 201,
    data: { uuid: "new-visit-note-encounter-uuid" },
  } as Awaited<ReturnType<typeof saveVisitNote>>);

  renderVisitNotesForm();

  const diagnosisSearchBox = screen.getByPlaceholderText(
    "Choose a primary diagnosis",
  );
  await user.type(diagnosisSearchBox, "Diabetes Mellitus");
  await user.click(
    await screen.findByRole("button", { name: "Diabetes Mellitus" }),
  );

  const codigoPrestacionalSearchBox = screen.getByRole("searchbox", {
    name: /indique el código prestacional/i,
  });
  await user.type(codigoPrestacionalSearchBox, "consulta");

  await waitFor(() =>
    expect(mockFetchPrestacionalConceptsByName).toHaveBeenCalledWith(
      "consulta",
      "Codigos Prestacionales",
    ),
  );
  await user.click(
    await screen.findByRole("button", { name: "001 - Consulta externa" }),
  );

  expect(screen.getByTitle("001 - Consulta externa")).toBeInTheDocument();
  expect(codigoPrestacionalSearchBox).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "002 - Control ambulatorio" }),
  ).not.toBeInTheDocument();

  const submitButton = screen.getByRole("button", { name: /Save and close/i });
  await user.click(submitButton);

  await waitFor(() => expect(mockSaveVisitNote).toHaveBeenCalledTimes(1));
  expect(mockAssertCanonicalVisitNoteCanBeCreated).toHaveBeenCalledWith(
    mockPatient.id,
    "active-visit-uuid",
    ConfigMock.visitNoteConfig.encounterTypeUuid,
    ConfigMock.visitNoteConfig.formConceptUuid,
  );
  expect(
    mockAssertCanonicalVisitNoteCanBeCreated.mock.invocationCallOrder[0],
  ).toBeLessThan(mockSaveVisitNote.mock.invocationCallOrder[0]);
  expect(mockSaveVisitNote).toHaveBeenCalledWith(
    expect.any(AbortController),
    expect.objectContaining({
      obs: expect.arrayContaining([
        expect.objectContaining({
          concept: {
            display: "",
            uuid: defaultVisitNoteClinicalConceptUuids.codigoPrestacionalConceptUuid,
          },
          formFieldNamespace: "visit-notes",
          formFieldPath: "codigo-prestacional",
          // The selected catalog concept goes out as valueCoded. Sending its display
          // text instead would require a Text question, and the previous target (the
          // catalog ConvSet, datatype N/A) rejected every value with "Don't know how
          // to handle ZZ", aborting the whole encounter.
          value: "prestacional-001",
        }),
      ]),
    }),
  );
});

test("blocks a stale create when a canonical summary appears before submit", async () => {
  const user = userEvent.setup();
  mockAssertCanonicalVisitNoteCanBeCreated.mockRejectedValueOnce(
    new Error("Existing canonical summary"),
  );

  renderVisitNotesForm();
  await selectPrimaryDiagnosis(user);
  await selectCodigoPrestacional(user);
  await user.click(screen.getByRole("button", { name: /Save and close/i }));

  await waitFor(() =>
    expect(mockAssertCanonicalVisitNoteCanBeCreated).toHaveBeenCalledTimes(1),
  );
  expect(mockSaveVisitNote).not.toHaveBeenCalled();
  expect(mockShowSnackbar).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "error",
      subtitle: "The visit note could not be saved.",
    }),
  );
});

test("blocks saving until a catalog concept backs the mandatory codigo prestacional", async () => {
  const user = userEvent.setup();

  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );

  renderVisitNotesForm();

  const diagnosisSearchBox = screen.getByPlaceholderText(
    "Choose a primary diagnosis",
  );
  await user.type(diagnosisSearchBox, "Diabetes Mellitus");
  await user.click(
    await screen.findByRole("button", { name: "Diabetes Mellitus" }),
  );

  await user.click(screen.getByRole("button", { name: /Save and close/i }));

  // The label says "Obligatorio", so free text without a catalog selection must
  // not produce an encounter at all.
  expect(
    await screen.findByText("Seleccione un código prestacional del catálogo"),
  ).toBeInTheDocument();
  expect(mockSaveVisitNote).not.toHaveBeenCalled();
});

test("closes the form and the workspace when the cancel button is clicked", async () => {
  const user = userEvent.setup();

  renderVisitNotesForm();

  const cancelButton = screen.getByRole("button", { name: /Discard/i });
  await user.click(cancelButton);

  expect(defaultProps.closeWorkspace).toHaveBeenCalledTimes(1);
});

async function selectCodigoPrestacional(
  user: ReturnType<typeof userEvent.setup>,
) {
  mockFetchPrestacionalConceptsByName.mockResolvedValue([
    { uuid: "prestacional-001", display: "001 - Consulta externa" },
  ]);
  const searchBox = screen.getByRole("searchbox", {
    name: /indique el código prestacional/i,
  });
  await user.type(searchBox, "consulta");
  await user.click(
    await screen.findByRole("button", { name: "001 - Consulta externa" }),
  );
}

async function selectPrimaryDiagnosis(
  user: ReturnType<typeof userEvent.setup>,
) {
  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );
  const searchBox = screen.getByPlaceholderText("Choose a primary diagnosis");
  await user.type(searchBox, "Diabetes Mellitus");
  await user.click(
    await screen.findByRole("button", { name: "Diabetes Mellitus" }),
  );
}

test("fails closed without an active visit and performs no clinical REST mutation", async () => {
  const user = userEvent.setup();

  renderVisitNotesForm({}, { visitContext: null });
  await selectPrimaryDiagnosis(user);
  await selectCodigoPrestacional(user);
  await user.type(
    screen.getByRole("textbox", { name: /Additional notes/i }),
    "Synthetic note",
  );
  await user.click(screen.getByRole("button", { name: /Save and close/i }));

  await waitFor(() =>
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "error",
        subtitle: "An active visit is required to save this visit note.",
      }),
    ),
  );
  expect(mockSaveVisitNote).not.toHaveBeenCalled();
  expect(mockUpdateVisitNote).not.toHaveBeenCalled();
  expect(mockSavePatientDiagnosis).not.toHaveBeenCalled();
  expect(mockDeletePatientDiagnosis).not.toHaveBeenCalled();
});

test("fails closed without an active visit location and performs no clinical REST mutation", async () => {
  const user = userEvent.setup();

  renderVisitNotesForm(
    {},
    {
      visitContext: {
        uuid: "active-visit-uuid",
      } as never,
    },
  );
  await selectPrimaryDiagnosis(user);
  await selectCodigoPrestacional(user);
  await user.type(
    screen.getByRole("textbox", { name: /Additional notes/i }),
    "Synthetic note",
  );
  await user.click(screen.getByRole("button", { name: /Save and close/i }));

  await waitFor(() =>
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "error",
        subtitle: "An active visit with an operational UPSS is required.",
      }),
    ),
  );
  expect(mockSaveVisitNote).not.toHaveBeenCalled();
  expect(mockUpdateVisitNote).not.toHaveBeenCalled();
  expect(mockSavePatientDiagnosis).not.toHaveBeenCalled();
  expect(mockDeletePatientDiagnosis).not.toHaveBeenCalled();
});

test.each([
  ["a different visit", { uuid: "different-visit-uuid" }],
  ["no visit association", undefined],
] as const)(
  "fails closed when an edited encounter has %s",
  async (_scenario, encounterVisit) => {
    const user = userEvent.setup();
    const mockEncounter = {
      id: "encounter-uuid",
      uuid: "encounter-uuid",
      rawDatetime: "2026-07-01T10:00:00.000Z",
      ...(encounterVisit ? { visit: encounterVisit } : {}),
      obs: [
        {
          uuid: "codigo-obs-uuid",
          concept: {
            uuid: defaultVisitNoteClinicalConceptUuids.codigoPrestacionalConceptUuid,
          },
          value: {
            uuid: "prestacional-001",
            display: "001 - Consulta externa",
          },
          formFieldNamespace: "visit-notes",
          formFieldPath: "codigo-prestacional",
        },
      ],
      diagnoses: [
        {
          uuid: "diagnosis-uuid",
          diagnosis: { coded: { uuid: "cie10-uuid" } },
          certainty: "PROVISIONAL",
          rank: 1,
          display: "Synthetic diagnosis",
        },
      ],
    };

    renderVisitNotesForm({
      formContext: "editing",
      encounter: mockEncounter as unknown as EditableVisitNoteEncounter,
    });
    await user.type(
      screen.getByRole("textbox", { name: /Additional notes/i }),
      "Synthetic edit",
    );
    await user.click(screen.getByRole("button", { name: /Save and close/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "error",
          subtitle:
            "This visit note belongs to a different visit and cannot be edited from the active visit.",
        }),
      ),
    );
    expect(mockUpdateVisitNote).not.toHaveBeenCalled();
    expect(mockSaveVisitNote).not.toHaveBeenCalled();
    expect(mockSavePatientDiagnosis).not.toHaveBeenCalled();
    expect(mockDeletePatientDiagnosis).not.toHaveBeenCalled();
  },
);

test("renders a success snackbar upon successfully recording a visit note", async () => {
  const user = userEvent.setup();
  const mockConsoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const onAfterSave = vi
    .fn()
    .mockRejectedValue(new Error("Synthetic cache revalidation failure"));

  const successPayload = {
    encounterProviders: expect.arrayContaining([
      {
        encounterRole: ConfigMock.visitNoteConfig.clinicianEncounterRole,
        provider: mockSessionDataResponse.data.currentProvider.uuid,
      },
    ]),
    encounterType: ConfigMock.visitNoteConfig.encounterTypeUuid,
    diagnoses: expect.arrayContaining([
      expect.objectContaining({
        diagnosis: { coded: "119481AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        patient: mockPatient.id,
        rank: 1,
      }),
    ]),
    form: ConfigMock.visitNoteConfig.formConceptUuid,
    location: "operational-location-uuid",
    obs: expect.arrayContaining([
      {
        concept: { display: "", uuid: "162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        value: "Sample clinical note",
      },
      {
        concept: { display: "", uuid: "71b58cff-879b-4358-98d5-2165434d4324" },
        value: "Cough and fever",
      },
    ]),
    patient: mockPatient.id,
    visit: "active-visit-uuid",
  };

  mockSaveVisitNote.mockResolvedValueOnce({
    status: 201,
    data: { uuid: "new-visit-note-encounter-uuid" },
  } as Awaited<ReturnType<typeof saveVisitNote>>);
  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );

  renderVisitNotesForm(
    { onAfterSave },
    {
      visitContext: {
        uuid: "active-visit-uuid",
        location: {
          uuid: "operational-location-uuid",
          display: "UPSS - CONSULTA EXTERNA",
        },
      } as never,
    },
  );

  const chiefComplaint = screen.getByRole("textbox", {
    name: /Chief complaint/i,
  });
  const clinicalNote = screen.getByRole("textbox", {
    name: /Additional notes/i,
  });
  const searchBox = screen.getByPlaceholderText("Choose a primary diagnosis");
  await user.type(searchBox, "Diabetes Mellitus");
  const targetSearchResult = await screen.findByText("Diabetes Mellitus");
  expect(targetSearchResult).toBeInTheDocument();

  await user.click(targetSearchResult);

  await user.type(chiefComplaint, "Cough and fever");
  await user.clear(clinicalNote);
  await user.type(clinicalNote, "Sample clinical note");
  expect(clinicalNote).toHaveValue("Sample clinical note");

  const submitButton = screen.getByRole("button", { name: /Save and close/i });
  await selectCodigoPrestacional(user);
  await user.click(submitButton);

  await waitFor(() => expect(mockSaveVisitNote).toHaveBeenCalledTimes(1));
  expect(onAfterSave).toHaveBeenCalledTimes(1);
  expect(mockSaveVisitNote).toHaveBeenCalledWith(
    expect.any(AbortController),
    expect.objectContaining(successPayload),
  );
  expect(mockSavePatientDiagnosis).not.toHaveBeenCalled();
  expect(mockDeletePatientDiagnosis).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: "success",
      subtitle: "It is now visible on the Visits page",
      title: "Visit note saved",
    }),
  );
  mockConsoleError.mockRestore();
});

test("renders an error snackbar if there was a problem recording a condition", async () => {
  const user = userEvent.setup();
  const onAfterSave = vi.fn();

  const error = {
    message: "Internal Server Error",
    response: {
      status: 500,
      statusText: "Internal Server Error",
    },
  };

  mockSaveVisitNote.mockRejectedValueOnce(error);
  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );

  renderVisitNotesForm({ onAfterSave });

  const submitButton = screen.getByRole("button", { name: /Save and close/i });

  const searchBox = screen.getByPlaceholderText("Choose a primary diagnosis");
  await user.type(searchBox, "Diabetes Mellitus");
  const targetSearchResult = await screen.findByText("Diabetes Mellitus");
  expect(targetSearchResult).toBeInTheDocument();

  await user.click(targetSearchResult);

  const clinicalNote = screen.getByRole("textbox", {
    name: /Additional notes/i,
  });
  await user.clear(clinicalNote);
  await user.type(clinicalNote, "Sample clinical note");
  expect(clinicalNote).toHaveValue("Sample clinical note");

  await selectCodigoPrestacional(user);

  await user.click(submitButton);

  await waitFor(() =>
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: "error",
      subtitle: "The visit note could not be saved.",
      title: "Error saving visit note",
    }),
  );
  expect(onAfterSave).not.toHaveBeenCalled();
});

test("initializes form with existing encounter data when in edit mode", () => {
  const mockEncounter = {
    id: "123",
    uuid: "123",
    datetime: "20/03/2024",
    rawDatetime: "2024-03-20T10:00:00.000Z",
    obs: [
      {
        concept: { uuid: "162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        value: "Existing clinical note",
      },
    ],
    diagnoses: [
      {
        uuid: "456",
        diagnosis: {
          coded: { uuid: "789", display: "Diabetes Mellitus" },
        },
        certainty: "PROVISIONAL",
        rank: 1,
        display: "Diabetes Mellitus",
      },
    ],
  };

  renderVisitNotesForm({
    formContext: "editing",
    encounter: mockEncounter as unknown as EditableVisitNoteEncounter,
  });

  // Verify date is pre-filled
  expect(screen.getByLabelText(/visit date/i)).toHaveValue("20/03/2024");

  // Verify clinical note is pre-filled
  expect(
    screen.getByRole("textbox", { name: /additional notes/i }),
  ).toHaveValue("Existing clinical note");

  // Verify diagnosis is pre-filled
  expect(screen.getByTitle("Diabetes Mellitus")).toBeInTheDocument();
});

test("updates an existing visit note atomically while preserving its clinical ownership", async () => {
  const user = userEvent.setup();
  const mockEncounter = {
    id: "123",
    uuid: "123",
    datetime: "20/03/2024",
    rawDatetime: "2024-03-20T10:00:00.000Z",
    visit: { uuid: "active-visit-uuid" },
    location: { uuid: "original-location-uuid" },
    encounterProviders: [
      {
        uuid: "encounter-provider-assignment-uuid",
        encounterRole: { uuid: "original-role-uuid" },
        provider: {
          uuid: "original-provider-uuid",
          person: { display: "Original Provider" },
        },
      },
    ],
    obs: [
      {
        uuid: "clinical-note-obs-uuid",
        concept: { uuid: "162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        value: "Existing clinical note",
      },
      {
        uuid: "chief-complaint-obs-uuid",
        concept: {
          uuid: defaultVisitNoteClinicalConceptUuids.chiefComplaintConceptUuid,
        },
        value: "Existing complaint",
      },
      {
        uuid: "codigo-prestacional-obs-uuid",
        concept: {
          uuid: defaultVisitNoteClinicalConceptUuids.codigoPrestacionalConceptUuid,
        },
        value: { uuid: "prestacional-001", display: "001 - Consulta externa" },
        formFieldNamespace: "visit-notes",
        formFieldPath: "codigo-prestacional",
      },
      {
        uuid: "tipo-diagnostico-obs-uuid",
        concept: { uuid: ConfigMock.visitNoteConfig.diagnosisTypeConceptUuid },
        value: ConfigMock.visitNoteConfig.diagnosisTypePresuntivoUuid,
        formFieldNamespace: "visit-notes",
        formFieldPath: "tipo-dx-789",
      },
    ],
    diagnoses: [
      {
        uuid: "456",
        diagnosis: {
          coded: { uuid: "789", display: "Diabetes Mellitus" },
        },
        certainty: "PROVISIONAL",
        rank: 1,
        display: "Diabetes Mellitus",
      },
    ],
  };

  const updatePayload = {
    encounterProviders: [
      {
        uuid: "encounter-provider-assignment-uuid",
        encounterRole: "original-role-uuid",
        provider: "original-provider-uuid",
      },
    ],
    encounterType: ConfigMock.visitNoteConfig.encounterTypeUuid,
    diagnoses: [
      {
        uuid: "456",
        patient: mockPatient.id,
        condition: null,
        diagnosis: { coded: "789" },
        certainty: "PROVISIONAL",
        rank: 1,
      },
    ],
    form: ConfigMock.visitNoteConfig.formConceptUuid,
    location: "original-location-uuid",
    obs: expect.arrayContaining([
      {
        concept: { display: "", uuid: "162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        value: "Updated clinical note",
        uuid: "clinical-note-obs-uuid",
      },
      { uuid: "chief-complaint-obs-uuid", voided: true },
      {
        concept: {
          display: "",
          uuid: defaultVisitNoteClinicalConceptUuids.codigoPrestacionalConceptUuid,
        },
        formFieldNamespace: "visit-notes",
        formFieldPath: "codigo-prestacional",
        value: "prestacional-001",
        uuid: "codigo-prestacional-obs-uuid",
      },
      {
        concept: {
          display: "",
          uuid: ConfigMock.visitNoteConfig.diagnosisTypeConceptUuid,
        },
        formFieldNamespace: "visit-notes",
        formFieldPath: "tipo-dx-789",
        value: ConfigMock.visitNoteConfig.diagnosisTypePresuntivoUuid,
        uuid: "tipo-diagnostico-obs-uuid",
      },
    ]),
    patient: mockPatient.id,
  };

  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );
  mockUpdateVisitNote.mockResolvedValueOnce({
    status: 200,
    body: "Visit note updated",
  } as unknown as Awaited<ReturnType<typeof updateVisitNote>>);

  renderVisitNotesForm({
    formContext: "editing",
    encounter: mockEncounter as unknown as EditableVisitNoteEncounter,
  });

  // Update clinical note
  const clinicalNote = screen.getByRole("textbox", {
    name: /Additional notes/i,
  });
  await user.clear(clinicalNote);
  await user.type(clinicalNote, "Updated clinical note");
  expect(clinicalNote).toHaveValue("Updated clinical note");
  await user.clear(screen.getByRole("textbox", { name: /Chief complaint/i }));

  // Submit form
  const submitButton = screen.getByRole("button", { name: /Save and close/i });
  await user.click(submitButton);

  await waitFor(() =>
    expect(mockUpdateVisitNote).toHaveBeenCalledWith(
      expect.any(AbortController),
      mockEncounter.id,
      expect.objectContaining(updatePayload),
    ),
  );
  expect(mockUpdateVisitNote.mock.calls[0][2]).not.toHaveProperty("visit");
  expect(mockSavePatientDiagnosis).not.toHaveBeenCalled();
  expect(mockDeletePatientDiagnosis).not.toHaveBeenCalled();
});

test("handles existing diagnoses correctly when in edit mode", async () => {
  const user = userEvent.setup();
  const mockEncounter = {
    id: "123",
    uuid: "123",
    datetime: "20/03/2024",
    rawDatetime: "2024-03-20T10:00:00.000Z",
    diagnoses: [
      {
        uuid: "456",
        diagnosis: {
          coded: { uuid: "789", display: "Diabetes Mellitus" },
        },
        certainty: "PROVISIONAL",
        rank: 1,
        display: "Diabetes Mellitus",
      },
    ],
  };

  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );

  renderVisitNotesForm({
    formContext: "editing",
    encounter: mockEncounter as unknown as EditableVisitNoteEncounter,
  });

  // Verify existing diagnosis is displayed
  expect(screen.getByTitle("Diabetes Mellitus")).toBeInTheDocument();

  // Remove existing diagnosis
  const closeTagButton = screen.getByRole("button", { name: /clear filter/i });
  await user.click(closeTagButton);

  // Verify no diagnoses are selected
  expect(
    screen.getByText(/No diagnosis selected — Enter a diagnosis below/i),
  ).toBeInTheDocument();

  // Add new diagnosis
  const searchBox = screen.getByPlaceholderText("Choose a primary diagnosis");
  await user.type(searchBox, "Diabetes Mellitus");
  const targetSearchResult = await screen.findByText("Diabetes Mellitus");
  await user.click(targetSearchResult);

  // Verify new diagnosis is displayed
  expect(screen.getByTitle("Diabetes Mellitus")).toBeInTheDocument();
});

test("allows saving visit note without primary diagnosis when isPrimaryDiagnosisRequired is false", async () => {
  const user = userEvent.setup();

  mockUseConfig.mockReturnValue(
    getMockConfig({ isPrimaryDiagnosisRequired: false }),
  );

  const successPayload = {
    encounterProviders: expect.arrayContaining([
      {
        encounterRole: ConfigMock.visitNoteConfig.clinicianEncounterRole,
        provider: mockSessionDataResponse.data.currentProvider.uuid,
      },
    ]),
    encounterType: ConfigMock.visitNoteConfig.encounterTypeUuid,
    form: ConfigMock.visitNoteConfig.formConceptUuid,
    location: "operational-location-uuid",
    obs: expect.arrayContaining([
      {
        concept: { display: "", uuid: "162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        value: "Clinical note without diagnosis",
      },
    ]),
    patient: mockPatient.id,
  };

  mockSaveVisitNote.mockResolvedValueOnce({
    status: 201,
    body: "Visit note created",
  } as unknown as Awaited<ReturnType<typeof saveVisitNote>>);
  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );

  renderVisitNotesForm();

  const clinicalNote = screen.getByRole("textbox", {
    name: /Additional notes/i,
  });
  await user.clear(clinicalNote);
  await user.type(clinicalNote, "Clinical note without diagnosis");
  expect(clinicalNote).toHaveValue("Clinical note without diagnosis");

  const submitButton = screen.getByRole("button", { name: /Save and close/i });
  await selectCodigoPrestacional(user);
  await user.click(submitButton);

  // Should not show validation error for missing primary diagnosis
  expect(
    screen.queryByText(/choose at least one primary diagnosis/i),
  ).not.toBeInTheDocument();

  // Should successfully save the visit note
  expect(mockSaveVisitNote).toHaveBeenCalledTimes(1);
  expect(mockSaveVisitNote).toHaveBeenCalledWith(
    expect.any(AbortController),
    expect.objectContaining(successPayload),
  );

  // Reset mock for other tests
  mockUseConfig.mockReturnValue(getMockConfig());
});

test("requires primary diagnosis when isPrimaryDiagnosisRequired is true", async () => {
  const user = userEvent.setup();

  mockUseConfig.mockReturnValue(
    getMockConfig({ isPrimaryDiagnosisRequired: true }),
  );

  mockFetchDiagnosisConceptsByName.mockResolvedValue(
    diagnosisSearchResponse.results,
  );

  renderVisitNotesForm();

  const clinicalNote = screen.getByRole("textbox", {
    name: /Additional notes/i,
  });
  await user.clear(clinicalNote);
  await user.type(clinicalNote, "Clinical note without diagnosis");

  const submitButton = screen.getByRole("button", { name: /save and close/i });
  await user.click(submitButton);

  // Should show validation error for missing primary diagnosis
  expect(
    screen.getByText(/choose at least one primary diagnosis/i),
  ).toBeInTheDocument();

  // Should not attempt to save
  expect(mockSaveVisitNote).not.toHaveBeenCalled();

  // Reset mock for other tests
  mockUseConfig.mockReturnValue(getMockConfig());
});
