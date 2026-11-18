import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getEncounterObservations, getSurveillanceCase, updateSurveillanceCase } from "./api";
import { CaseModal, caseUpdatePayload } from "./case-modal.component";
import { catalogue } from "./test-fixtures";
import type { SurveillanceCase } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === "string" ? fallback : key),
  }),
}));
vi.mock("@openmrs/esm-framework", () => ({ openmrsFetch: vi.fn(), restBaseUrl: "/ws/rest/v1", fhirBaseUrl: "/ws/fhir2/R4" }));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getSurveillanceCase: vi.fn(),
  getPatient: vi.fn(),
  getEncounterObservations: vi.fn(),
  updateSurveillanceCase: vi.fn(),
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">Error seguro</p>,
}));
vi.mock("./infection-address-selector.component", () => ({
  InfectionAddressSelector: ({ onChange }: { onChange: (value: string, display?: string) => void }) => (
    <>
      <button type="button" onClick={() => onChange("center-2", "Otro centro")}>
        Elegir centro
      </button>
      <button type="button" onClick={() => onChange("")}>
        Quitar centro
      </button>
    </>
  ),
}));
const record: SurveillanceCase = {
  vaccinationStatus: "IGN",
  surveillanceType: "PASIVA",
  investigationForm: false,
  habitualResidence: "1",
  uuid: "synthetic-case",
  patientDisplay: "Paciente de prueba",
  patientIdentifier: "TEST-DNI",
  patientSex: "F",
  patientAge: 26,
  patientResidence: "Dirección sintética",
  investigationDate: "2026-09-01",
  patientUuid: "synthetic-patient",
  encounterUuid: "synthetic-encounter",
  providerUuid: "synthetic-provider",
  locationUuid: "synthetic-location",
  diagnosisUuid: "synthetic-diagnosis",
  diagnosisDisplay: "Diagnóstico sintético",
  diagnosisType: "PROBABLE",
  origin: "AUTOCTONO",
  onsetDate: "2026-09-01",
  notificationDate: "2026-09-02T12:00:00-05:00",
  testOrderUuid: "synthetic-order",
  encounterDisplay: "Atención sintética",
  encounterDate: "2026-09-01",
  locationDisplay: "Localidad sintética",
  providerDisplay: "Profesional sintético",
  infectionAddressDisplay: "Provincia → Distrito → Centro poblado",
  testOrderDisplay: "Prueba sintética",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record });
  vi.mocked(getEncounterObservations).mockResolvedValue([]);
  vi.mocked(updateSurveillanceCase).mockResolvedValue(record);
});
const mount = (mode: "view" | "edit" = "edit", onClose = vi.fn(), onSaved = vi.fn()) =>
  render(
    <CaseModal uuid={record.uuid} mode={mode} catalogue={catalogue} onClose={onClose} onSaved={onSaved} />,
  );

it("retries a case that could not be loaded", async () => {
  vi.mocked(getSurveillanceCase).mockRejectedValueOnce(new Error("offline"));
  mount("view");
  expect(await screen.findByRole("alert")).toHaveTextContent("Error seguro");
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(getSurveillanceCase).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("Paciente de prueba")).toBeInTheDocument();
});

it("revalidates dates together, changes place and pregnancy and closes", async () => {
  const onClose = vi.fn();
  mount("edit", onClose);
  fireEvent.change(await screen.findByLabelText("caseDetails.fields.notificationDate"), {
    target: { value: "2026-08-01T12:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await screen.findByText("validation.beforeOnset");
  fireEvent.change(screen.getByLabelText(/caseDetails\.fields\.onsetDate/), {
    target: { value: "01/08/2026" },
  });
  await waitFor(() => expect(screen.queryByText("validation.beforeOnset")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Elegir centro" }));
  fireEvent.click(screen.getByRole("button", { name: "Quitar centro" }));
  fireEvent.change(screen.getByLabelText("fields.pregnant"), { target: { value: "SI" } });
  expect(screen.getByLabelText("fields.pregnant")).toHaveValue("SI");
  fireEvent.click(screen.getAllByRole("button", { name: /^close$/i })[0]);
  expect(onClose).toHaveBeenCalled();
});

it("omits empty optional values from the update payload", () => {
  const payload = caseUpdatePayload({ ...record, origin: "", vaccinationStatus: "", surveillanceType: "", onsetDate: "" });
  expect(payload).toMatchObject({ origin: undefined, vaccinationStatus: undefined, surveillanceType: undefined, onsetDate: undefined });
});

it("derives the classification from the selected laboratory result and edits the investigation form", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, patientDeathDate: "2026-09-03", deathAttribution: undefined });
  vi.mocked(getEncounterObservations).mockResolvedValue([
    { resourceType: "Observation", id: "positive", code: { text: "Examen" }, valueString: "Positivo" },
    { resourceType: "Observation", id: "negative", code: { text: "Examen" }, valueString: "No reactivo" },
  ]);
  mount("edit");
  const lab = await screen.findByLabelText(/caseDetails\.fields\.laboratoryObservationUuid/);
  fireEvent.change(lab, { target: { value: "positive" } });
  expect(screen.getByLabelText(/caseDetails\.fields\.diagnosisType/)).toHaveValue("CONFIRMADO");
  fireEvent.change(lab, { target: { value: "negative" } });
  expect(screen.getByLabelText(/caseDetails\.fields\.diagnosisType/)).toHaveValue("DESCARTADO");
  fireEvent.change(lab, { target: { value: "" } });
  expect(screen.getByLabelText(/caseDetails\.fields\.diagnosisType/)).toHaveValue("PROBABLE");
  const form = screen.getByLabelText(/fields\.investigationForm/);
  fireEvent.change(form, { target: { value: "SI" } });
  expect(form).toHaveValue("SI");
  fireEvent.change(form, { target: { value: "" } });
  expect(form).toHaveValue("");
});

it("shows an unanswered investigation form as unavailable", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, investigationForm: undefined });
  mount("view");
  const label = await screen.findByText("fields.investigationForm");
  expect(label.nextElementSibling?.textContent).not.toContain("vaccinationValues");
});
