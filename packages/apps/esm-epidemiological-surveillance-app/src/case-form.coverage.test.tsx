import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseForm } from "./case-form.component";
import {
  createSurveillanceCase,
  encountersForPatient,
  getEncounterDiagnosesDetails,
  getEncounterObservations,
  getPatient,
  references,
  searchPatients,
  SurveillanceApiError,
} from "./api";
import type { FhirResource } from "./types";
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
      icd10: "A90",
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
vi.mock("./infection-address-selector.component", () => ({
  InfectionAddressSelector: ({ onChange }: { onChange: (value: string, display?: string) => void }) => (
    <>
      <button type="button" onClick={() => onChange("center", "Synthetic center")}>
        Choose infection place
      </button>
      <button type="button" onClick={() => onChange("")}>
        Clear infection place
      </button>
    </>
  ),
}));

const failure = "Could not complete the operation";
const choosePatient = async () => {
  fireEvent.change(screen.getByPlaceholderText("Select a patient"), { target: { value: "Synthetic" } });
  fireEvent.click(await screen.findByRole("option", { name: /Synthetic Patient/ }));
};

describe("case registration boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connection.online = true;
  });

  it("reports a failed initial load", async () => {
    vi.mocked(getPatient).mockRejectedValueOnce(new Error("offline"));
    render(<CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />);
    expect(await screen.findByText(failure)).toBeInTheDocument();
  });

  it("selects the first notifiable diagnosis when the stored event differs", async () => {
    render(<CaseForm catalogue={catalogue} initial={{ ...request, eventUuid: "other-event" }} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText(/Encounter diagnosis/)).toHaveValue("encounter-diagnosis");
  });

  it("reports unavailable professionals and localities", async () => {
    vi.mocked(references).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"));
    render(<CaseForm catalogue={catalogue} onSaved={vi.fn()} />);
    expect(await screen.findByText(failure)).toBeInTheDocument();
  });

  it("reports patient search and encounter loading failures", async () => {
    vi.mocked(searchPatients).mockRejectedValueOnce(new Error("offline"));
    const view = render(<CaseForm catalogue={catalogue} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Select a patient"), { target: { value: "Synthetic" } });
    expect(await screen.findByText(failure)).toBeInTheDocument();
    view.unmount();
    vi.mocked(encountersForPatient).mockRejectedValueOnce(new Error("offline"));
    render(<CaseForm catalogue={catalogue} onSaved={vi.fn()} />);
    await choosePatient();
    expect(await screen.findByText(failure)).toBeInTheDocument();
  });

  it("loads diagnoses for the chosen encounter and ignores superseded or failed loads", async () => {
    render(<CaseForm catalogue={catalogue} onSaved={vi.fn()} />);
    await choosePatient();
    const source = await screen.findByLabelText(/Source care record/);
    await waitFor(() => expect(source).toBeEnabled());
    let resolveStale!: (value: never[]) => void;
    vi.mocked(getEncounterDiagnosesDetails).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStale = resolve as (value: never[]) => void;
      }),
    );
    fireEvent.change(source, { target: { value: "other-care" } });
    fireEvent.change(source, { target: { value: "source" } });
    await act(async () => resolveStale([]));
    await waitFor(() => expect(source).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText(/Encounter diagnosis/)).toHaveValue("encounter-diagnosis");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    vi.mocked(getEncounterDiagnosesDetails).mockRejectedValueOnce(new Error("offline"));
    fireEvent.change(screen.getByLabelText(/Source care record/), { target: { value: "other-care" } });
    expect(await screen.findByText(failure)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Source care record/), { target: { value: "" } });
    expect(screen.getByLabelText(/Source care record/)).toHaveValue("");
  });

  it("maps server field errors and clears them while editing every case field", async () => {
    vi.mocked(getEncounterObservations).mockResolvedValue([
      { resourceType: "Observation", id: "lab-1", code: { text: "Synthetic test" }, valueString: "Positivo" },
    ]);
    vi.mocked(createSurveillanceCase).mockRejectedValueOnce(
      new SurveillanceApiError("INVALID_DATE", 422, ["onsetDate", "notificationDate"]),
    );
    render(<CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    await waitFor(() => expect(createSurveillanceCase).toHaveBeenCalled());
    const diagnosis = await screen.findByLabelText(/Encounter diagnosis/);
    fireEvent.change(diagnosis, { target: { value: "" } });
    expect(diagnosis).toHaveValue("");
    fireEvent.change(diagnosis, { target: { value: "encounter-diagnosis" } });
    fireEvent.change(screen.getByLabelText(/Laboratory result/), { target: { value: "lab-1" } });
    expect(screen.getByLabelText(/Diagnosis classification/)).toHaveValue("CONFIRMED");
    fireEvent.change(screen.getByLabelText(/Laboratory result/), { target: { value: "" } });
    expect(screen.getByLabelText(/Diagnosis classification/)).toHaveValue("SUSPECTED");
    fireEvent.click(screen.getByRole("button", { name: "Choose infection place" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear infection place" }));
    fireEvent.click(screen.getByRole("button", { name: "Add trip" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove trip" }));
    const onset = screen.getByLabelText(/Symptom onset date/);
    fireEvent.change(onset, { target: { value: "18/01/2026" } });
    expect(onset).toHaveValue("18/01/2026");
  });

  it("returns to the case data when validation fails at submission", async () => {
    let resolvePatient!: (patient: FhirResource) => void;
    vi.mocked(getPatient).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePatient = resolve;
      }),
    );
    render(<CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Register case" })).toBeInTheDocument();
    await act(async () =>
      resolvePatient({
        resourceType: "Patient",
        id: "patient",
        name: [{ text: "Synthetic Patient" }],
        gender: "female",
        birthDate: "2026-01-25",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Register case" }));
    expect(createSurveillanceCase).not.toHaveBeenCalled();
    expect(await screen.findByLabelText(/Symptom onset date/)).toBeInTheDocument();
  });

  it("ignores results after unmounting, keeps locked selects and submits once", async () => {
    const early = render(<CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />);
    early.unmount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    let resolveCreate!: (value: { uuid: string; diagnosisUuid: string }) => void;
    vi.mocked(createSurveillanceCase).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }) as never,
    );
    render(<CaseForm catalogue={catalogue} initial={request} onSaved={vi.fn()} />);
    await screen.findByText("Synthetic Patient");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const label of [/Registering professional/, /Case locality/, /Diagnosis classification/]) {
      const locked = screen.getByLabelText(label);
      expect(locked).toBeDisabled();
      fireEvent.change(locked, { target: { value: "" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const register = screen.getByRole("button", { name: "Register case" });
    fireEvent.click(register);
    fireEvent.click(register);
    await act(async () => resolveCreate({ uuid: "case", diagnosisUuid: "diagnosis" }));
    expect(createSurveillanceCase).toHaveBeenCalledTimes(1);
  });
});
