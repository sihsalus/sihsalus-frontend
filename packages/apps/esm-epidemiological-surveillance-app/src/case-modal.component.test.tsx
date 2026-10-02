import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getSurveillanceCase,
  getPatient,
  getEncounterObservations,
  getEncounterDiagnosesDetails,
  updateSurveillanceCase,
  SurveillanceApiError,
} from "./api";
import { CaseModal } from "./case-modal.component";
import { catalogue } from "./test-fixtures";
import type { SurveillanceCase } from "./types";

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getSurveillanceCase: vi.fn(),
  getPatient: vi.fn(),
  getEncounterObservations: vi.fn(),
  getEncounterDiagnosesDetails: vi.fn(),
  updateSurveillanceCase: vi.fn(),
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">Error seguro</p>,
}));
const record: SurveillanceCase = {
  uuid: "synthetic-case",
  patientUuid: "synthetic-patient",
  encounterUuid: "synthetic-encounter",
  providerUuid: "synthetic-provider",
  locationUuid: "synthetic-location",
  diagnosisUuid: "synthetic-diagnosis",
  diagnosisDisplay: "Diagnóstico sintético",
  diagnosisType: "PROBABLE",
  origin: "AUTOCTONO",
  onsetDate: "2026-09-01",
  notificationDate: "2026-09-02",
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
  vi.mocked(getPatient).mockResolvedValue({
    resourceType: "Patient",
    id: record.patientUuid,
    name: [{ text: "Paciente de prueba" }],
    gender: "F",
    birthDate: "2000-01-01",
    identifier: [{ value: "TEST-DNI", type: { text: "DNI" } }],
    residence: "Dirección sintética",
  });
  vi.mocked(getEncounterDiagnosesDetails).mockResolvedValue([]);
  vi.mocked(getEncounterObservations).mockResolvedValue([
    {
      resourceType: "Observation",
      id: "synthetic-positive",
      orderUuid: "synthetic-order",
      orderDisplay: "Prueba sintética",
      code: { text: "Examen sintético" },
      valueString: "Positivo",
    },
  ]);
  vi.mocked(updateSurveillanceCase).mockResolvedValue(record);
});
const mount = (mode: "view" | "edit" = "view", onSaved = vi.fn()) =>
  render(
    <CaseModal
      uuid={record.uuid}
      mode={mode}
      catalogue={catalogue}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );

it("loads all case data and residence in a read-only modal", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, laboratoryObservationUuid: "synthetic-positive" });
  mount();
  expect(await screen.findByText("Dirección sintética")).toBeInTheDocument();
  expect(screen.getByText("TEST-DNI")).toBeInTheDocument();
  expect(screen.getByText("Paciente de prueba")).toBeInTheDocument();
  expect(
    screen.getByText("2026-09-01 · Atención sintética"),
  ).toBeInTheDocument();
  expect(screen.queryByText("caseDetails.fields.testOrderUuid")).not.toBeInTheDocument();
  expect(screen.getByText("Prueba sintética · Positivo")).toBeInTheDocument();
  expect(
    screen.getByText("Provincia → Distrito → Centro poblado"),
  ).toBeInTheDocument();
  for (const id of [
    record.uuid,
    record.patientUuid,
    record.encounterUuid,
    record.providerUuid,
    record.locationUuid,
    record.diagnosisUuid,
    "synthetic-order",
  ])
    expect(screen.queryByText(id)).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Guardar" }),
  ).not.toBeInTheDocument();
});
it("edits epidemiological fields without sending demographic or response fields", async () => {
  const saved = vi.fn();
  mount("edit", saved);
  fireEvent.change(
    await screen.findByLabelText(
      "caseDetails.fields.laboratoryObservationUuid",
    ),
    { target: { value: "synthetic-positive" } },
  );
  expect(
    screen.queryByRole("textbox", { name: "casesTable.patient" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(updateSurveillanceCase).toHaveBeenCalledWith(
    record.uuid,
    expect.objectContaining({
      diagnosisType: "CONFIRMADO",
      patientUuid: record.patientUuid,
      encounterUuid: record.encounterUuid,
      testOrderUuid: record.testOrderUuid,
    }),
  );
  const payload = vi.mocked(updateSurveillanceCase).mock.calls[0][1];
  expect(payload).not.toHaveProperty("uuid");
  expect(payload).not.toHaveProperty("diagnosisDisplay");
  expect(payload).not.toHaveProperty("residence");
});
it("locks editing based on the freshly loaded death date", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({
    ...record,
    deathDate: "2026-09-03",
  });
  mount("edit");
  await screen.findByText("caseDetails.locked");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Guardar" }),
  ).not.toBeInTheDocument();
});
it("allows saving a new death date but warns that it locks the case", async () => {
  mount("edit");
  fireEvent.change(
    await screen.findByLabelText("caseDetails.fields.deathDate"),
    { target: { value: "2026-09-03" } },
  );
  expect(screen.getByText("caseDetails.deathWarning")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() =>
    expect(updateSurveillanceCase).toHaveBeenCalledWith(
      record.uuid,
      expect.objectContaining({ deathDate: "2026-09-03" }),
    ),
  );
});
it("rejects dates before onset without submitting", async () => {
  mount("edit");
  fireEvent.change(
    await screen.findByLabelText("caseDetails.fields.notificationDate"),
    { target: { value: "2026-08-01" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await screen.findByText("Error seguro");
  expect(updateSurveillanceCase).not.toHaveBeenCalled();
});
it("preserves edited values after a rejected save", async () => {
  vi.mocked(updateSurveillanceCase).mockRejectedValue(
    new SurveillanceApiError("INVALID_REFERENCE", 422),
  );
  const saved = vi.fn();
  mount("edit", saved);
  fireEvent.change(
    await screen.findByLabelText(
      "caseDetails.fields.laboratoryObservationUuid",
    ),
    { target: { value: "synthetic-positive" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await screen.findByText("Error seguro");
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByLabelText("caseDetails.fields.diagnosisType")).toHaveValue(
    "CONFIRMADO",
  );
});
