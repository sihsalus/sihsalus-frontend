import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseForm } from "./case-form.component";
import { createSurveillanceCase, getPatient } from "./api";
import { catalogue, request } from "./test-fixtures";
import en from "../translations/en.json";
const connection = vi.hoisted(() => ({ online: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      let value: unknown = en;
      for (const part of key.split("."))
        value = (value as Record<string, unknown>)?.[part];
      return typeof value === "string" ? value : (fallback ?? key);
    },
  }),
}));
vi.mock("@openmrs/esm-framework", () => ({
  getUserFacingErrorMessage: (
    error: { code?: string },
    fallback: string,
    options?: { codeMessages?: Record<string, string> },
  ) => options?.codeMessages?.[error.code ?? ""] ?? fallback,
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
  useConnectivity: () => connection.online,
  useSession: () => ({
    authenticated: true,
    user: { uuid: "user", person: { uuid: "person" } },
  }),
}));
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  getPatient: vi.fn(async () => ({
    resourceType: "Patient",
    id: "patient",
    name: [{ text: "Synthetic Patient" }],
    gender: "female",
    birthDate: "2000-01-01",
  })),
  encountersForPatient: vi.fn(async () => [
    {
      resourceType: "Encounter",
      id: "source",
      subject: { reference: "Patient/patient" },
      period: { start: "2026-01-20" },
      type: [{ text: "Metaxenicas" }],
    },
    {
      resourceType: "Encounter",
      id: "other-care",
      subject: { reference: "Patient/patient" },
      period: { start: "2026-01-20" },
      type: [{ text: "Other care" }],
    },
  ]),
  getEncounterObservations: vi.fn(async () => []),
  addressChildren: vi.fn(async () => []),
  getEncounterDiagnoses: vi.fn(async () => ["diagnosis"]),
  getEncounterDiagnosesDetails: vi.fn(async () => [
    {
      uuid: "encounter-diagnosis",
      conceptUuid: "diagnosis",
      display: "Synthetic disease",
    },
  ]),
  searchPatients: vi.fn(async () => [
    {
      resourceType: "Patient",
      id: "patient",
      name: [{ text: "Synthetic Patient" }],
      birthDate: "2000-01-01",
    },
  ]),
  references: vi.fn(async (resource: string) =>
    resource === "provider"
      ? [
          {
            uuid: "provider",
            display: "Synthetic professional",
            person: { uuid: "person" },
          },
        ]
      : [{ uuid: "location", display: "Synthetic locality" }],
  ),
  createSurveillanceCase: vi.fn(async () => ({
    uuid: "case",
    diagnosisUuid: "diagnosis",
  })),
}));
describe("case registration screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connection.online = true;
  });
  it("does not advance when the patient context is missing", async () => {
    render(<CaseForm catalogue={catalogue} onSaved={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getAllByText("This field is required.")[0],
    ).toBeInTheDocument();
    expect(createSurveillanceCase).not.toHaveBeenCalled();
  });
  it("offers every active encounter of the selected patient", async () => {
    render(<CaseForm catalogue={catalogue} onSaved={vi.fn()} />);
    const patientInput = screen.getByPlaceholderText("Select a patient");
    fireEvent.change(patientInput, { target: { value: "Synthetic" } });
    await waitFor(() =>
      expect(screen.getByText(/Synthetic Patient/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Synthetic Patient.*years/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Synthetic Patient/));
    await waitFor(() =>
      expect(screen.getByText(/Metaxenicas/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Other care/)).toBeInTheDocument();
    expect(screen.getByText(/years/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Recording professional")).not.toBeInTheDocument();
  });
  it.each([null, "2026-01-22"])("gates attribution on the patient death date: %s", async (deathDate) => {
    vi.mocked(getPatient).mockResolvedValueOnce({ resourceType: "Patient", id: "patient",
      name: [{ text: "Synthetic Patient" }], deathDate: deathDate ?? undefined });
    render(<CaseForm catalogue={catalogue} initial={{ ...request, status: "CONFIRMED", laboratoryResultUuid: "synthetic-lab", deathAttribution: "SI" }} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const field = screen.queryByLabelText("Death attributable to the case");
    if (deathDate) {
      expect(field).toBeEnabled();
      expect(field).toHaveValue("SI");
      fireEvent.change(screen.getByLabelText("Death attributable to the case"), { target: { value: "NO" } });
    } else expect(field).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Death date")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await waitFor(() => expect(createSurveillanceCase).toHaveBeenCalledWith(
      expect.objectContaining({ deathAttribution: deathDate ? "NO" : null })));
  });
  it.each([true, false])("registers investigation form as %s and includes it in review", async (investigationForm) => {
    render(<CaseForm catalogue={catalogue} initial={{ ...request, investigationForm: undefined }} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText(/Investigation form/)).toHaveValue("");
    expect(screen.getByLabelText(/Investigation form/)).toHaveAccessibleName(/required/);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
    expect(createSurveillanceCase).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Investigation form/), { target: { value: investigationForm ? "SI" : "NO" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Investigation form").nextElementSibling).toHaveTextContent(investigationForm ? "Yes" : "No");
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await waitFor(() => expect(createSurveillanceCase).toHaveBeenCalledWith(expect.objectContaining({ investigationForm })));
  });
  it("requires habitual residence before review and submits its code", async () => {
    render(<CaseForm catalogue={catalogue} initial={{ ...request, habitualResidence: undefined }} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const field = screen.getByLabelText(/Habitual residence/);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
    expect(createSurveillanceCase).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("2. Marginal urban")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await waitFor(() => expect(createSurveillanceCase).toHaveBeenCalledWith(expect.objectContaining({ habitualResidence: "2" })));
  });
  it("shows the diagnosis name without appending the event name", async () => {
    render(<CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("option", { name: "A90 - Synthetic disease" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Synthetic disease (Synthetic disease)" })).not.toBeInTheDocument();
  });
  it("registers notification date and time with the UTC-5 offset without an investigation field", async () => {
    render(<CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByLabelText("Investigation date")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Notification date and time"), { target: { value: "2026-01-20T18:35" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("20/01/2026 18:35")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await waitFor(() => expect(createSurveillanceCase).toHaveBeenCalledWith(expect.objectContaining({ notificationDate: "2026-01-20T18:35-05:00" })));
    expect(vi.mocked(createSurveillanceCase).mock.calls[0][0]).not.toHaveProperty("investigationDate");
  });
  it("registers a draft within three steps", async () => {
    render(
      <CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />,
    );
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await waitFor(() =>
      expect(createSurveillanceCase).toHaveBeenCalledWith(
        expect.objectContaining({ diagnosisUuid: "encounter-diagnosis" }),
      ),
    );
  });
  it("does not close or refresh the page when case registration fails", async () => {
    vi.mocked(createSurveillanceCase).mockRejectedValueOnce(new Error("synthetic failure"));
    const saved = vi.fn();
    render(<CaseForm catalogue={catalogue} initial={request} onSaved={saved} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await screen.findByText("Could not complete the operation");
    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Register case" })).toBeInTheDocument();
  });
  it("captures all case fields on step two and keeps step three read-only", async () => {
    render(<CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Synthetic professional")).toBeInTheDocument();
    for (const label of ["Notification date and time", "Vaccination status", "Surveillance type"])
      expect(screen.getByLabelText(new RegExp(label))).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Vaccination status/), { target: { value: "SI" } });
    expect(screen.queryByLabelText("Investigation date")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByLabelText("Vaccination status")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Investigation date")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText(/Vaccination status/)).toHaveValue("SI");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await waitFor(() => expect(createSurveillanceCase).toHaveBeenCalledWith(expect.objectContaining({ vaccinationStatus: "SI" })));
  });
  it("preserves the active form when connectivity changes", async () => {
    const props = { catalogue, initial: request, onSaved: vi.fn() };
    const view = render(<CaseForm {...props} />);
    await screen.findByText("Synthetic Patient");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });
    connection.online = false;
    view.rerender(<CaseForm {...props} />);
    expect(screen.getByLabelText("Symptom onset date")).toHaveValue(
      "19/01/2026",
    );
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });
  it.each([
    ["male", "2000-01-01", false],
    ["female", "2016-01-21", false],
    ["female", "2016-01-20", true],
    ["female", "1970-01-21", true],
    ["female", "1970-01-20", false],
  ])("enforces pregnancy options for %s born %s", async (gender, birthDate, eligible) => {
    vi.mocked(getPatient).mockResolvedValueOnce({ resourceType: "Patient", id: "patient", name: [{ text: "Synthetic Patient" }], gender, birthDate });
    render(<CaseForm catalogue={catalogue} initial={{ ...request, pregnant: true }} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const pregnant = screen.queryByLabelText("Pregnant");
    if (eligible) {
      expect(pregnant).toBeEnabled();
      expect(pregnant).toHaveValue("SI");
      fireEvent.change(screen.getByLabelText("Pregnant"), { target: { value: "NO" } });
      expect(pregnant).toHaveValue("NO");
    } else {
      expect(pregnant).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    if (!eligible) expect(screen.queryByText("Pregnant")).not.toBeInTheDocument();
  });
});
