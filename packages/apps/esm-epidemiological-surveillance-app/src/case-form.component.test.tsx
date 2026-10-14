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
    for (const label of ["Investigation date", "Notification date", "Death date", "Vaccination status", "Surveillance type"])
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Vaccination status"), { target: { value: "SI" } });
    expect(screen.getByLabelText("Investigation date")).toBeDisabled();
    expect(screen.getByLabelText("Investigation date")).toHaveValue("20/01/2026");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByLabelText("Vaccination status")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Investigation date")).not.toBeInTheDocument();
    expect(screen.getByText("20/01/2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Vaccination status")).toHaveValue("SI");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await waitFor(() => expect(createSurveillanceCase).toHaveBeenCalledWith(expect.objectContaining({ vaccinationStatus: "SI", investigationDate: "2026-01-20" })));
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
    const pregnant = screen.getByLabelText("Pregnant");
    if (eligible) {
      expect(pregnant).toBeEnabled();
      expect(pregnant).toHaveValue("SI");
      fireEvent.change(pregnant, { target: { value: "NO" } });
      expect(pregnant).toHaveValue("NO");
    } else {
      expect(pregnant).toBeDisabled();
      expect(pregnant).toHaveValue("NO");
    }
  });
});
