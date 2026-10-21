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
  vaccinationStatus: "IGN",
  surveillanceType: "PASIVA",
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

it.each(["view", "edit"] as const)("hides attribution for a deceased probable case in %s mode", async (mode) => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, patientDeathDate: "2026-09-03", deathAttribution: "SI" });
  mount(mode);
  await screen.findByText("Paciente de prueba");
  expect(screen.queryByText("caseDetails.fields.deathAttribution")).not.toBeInTheDocument();
});

it.each(["vaccinationStatus", "surveillanceType"] as const)("requires %s when editing a historical case", async (field) => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, [field]: null });
  mount("edit");
  await screen.findByText("Paciente de prueba");
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(updateSurveillanceCase).not.toHaveBeenCalled();
  expect(document.getElementById(`edit-${field}`)).toHaveAttribute("aria-invalid", "true");
});

it("loads all case data and residence in a read-only modal", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({
    ...record,
    laboratoryObservationUuid: "synthetic-positive",
  });
  mount();
  expect(await screen.findByText("Dirección sintética")).toBeInTheDocument();
  expect(screen.getByText("TEST-DNI")).toBeInTheDocument();
  expect(screen.getByText("Paciente de prueba")).toBeInTheDocument();
  expect(getPatient).not.toHaveBeenCalled();
  expect(screen.getByText("26")).toBeInTheDocument();
  expect(
    screen.getByText("01/09/2026 · Atención sintética"),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("caseDetails.fields.testOrderUuid"),
  ).not.toBeInTheDocument();
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
it("formats immutable case details without required markers when editing", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({
    ...record,
    patientGivenNames: "Nombre Segundo",
    patientPaternalSurname: "Paterno",
    patientMaternalSurname: "Materno",
    encounterDate: "2026-09-01 23:00:31.0",
  });
  mount("edit");
  expect(
    await screen.findByText("Paterno Materno Nombre Segundo"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("01/09/2026 18:00 · Atención sintética"),
  ).toBeInTheDocument();
  for (const label of [
    "casesTable.patient",
    "caseDetails.fields.encounterUuid",
    "caseDetails.fields.providerUuid",
    "caseDetails.fields.locationUuid",
    "caseDetails.fields.diagnosisUuid",
  ]) {
    expect(screen.getByText(label).closest("dt")).not.toHaveTextContent(
      "requiredField",
    );
    expect(screen.getByText(label).closest("dt")).not.toHaveTextContent("*");
  }
  expect(
    screen.getByLabelText("caseDetails.fields.diagnosisType"),
  ).toBeDisabled();
  expect(screen.getByText(/caseDetails.fields.habitualResidence.*requiredField/)).toHaveTextContent(
    "caseDetails.fields.habitualResidence",
  );
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
  expect(
    screen.queryByLabelText("caseDetails.fields.investigationDate"),
  ).not.toBeInTheDocument();
  for (const field of [
    "patientGivenNames",
    "patientPaternalSurname",
    "patientMaternalSurname",
    "patientSex",
    "patientAge",
    "patientResidence",
  ])
    expect(payload).not.toHaveProperty(field);
  expect(payload).not.toHaveProperty("uuid");
  expect(payload).not.toHaveProperty("diagnosisDisplay");
  expect(payload).not.toHaveProperty("residence");
});
it("enables attribution for deceased patients and saves all three choices", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, diagnosisType: "CONFIRMADO", patientDeathDate: "2026-09-03" });
  mount("edit");
  const field = await screen.findByLabelText("caseDetails.fields.deathAttribution");
  expect(field).toBeEnabled();
  expect(field).toHaveValue("POR_DETERMINAR");
  for (const value of ["SI", "NO", "POR_DETERMINAR"]) {
    fireEvent.change(field, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(updateSurveillanceCase).toHaveBeenLastCalledWith(
      record.uuid, expect.objectContaining({ deathAttribution: value })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
  }
  expect(vi.mocked(updateSurveillanceCase).mock.calls[0][1]).not.toHaveProperty("deathDate");
});
it("clears stale attribution and hides it for a living patient", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, deathAttribution: "SI", patientDeathDate: null });
  mount("edit");
  await screen.findByLabelText("caseDetails.fields.origin");
  expect(screen.queryByLabelText("caseDetails.fields.deathAttribution")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(updateSurveillanceCase).toHaveBeenCalledWith(
    record.uuid, expect.objectContaining({ deathAttribution: null })));
});
it("rejects dates before onset without submitting", async () => {
  mount("edit");
  fireEvent.change(
    await screen.findByLabelText("caseDetails.fields.notificationDate"),
    { target: { value: "2026-08-01T12:00" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await screen.findByText("validation.beforeOnset");
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
  expect(screen.getByLabelText(/caseDetails.fields.diagnosisType/)).toHaveValue(
    "CONFIRMADO",
  );
});

it("keeps editable case fields in registration order and marks only non-null fields", async () => {
  render(
    <CaseModal
      uuid="case"
      mode="edit"
      catalogue={catalogue}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await screen.findByLabelText(/caseDetails.fields.diagnosisType/);
  const fields = Array.from(
    document.querySelectorAll("fieldset input, fieldset select"),
  )
    .map((item) => item.id)
    .filter((id) => id.startsWith("edit-"));
  expect(fields).toEqual([
    "edit-origin",
    "edit-onsetDate",
    "edit-laboratory",
    "edit-diagnosisType",
    "edit-habitualResidence",
    "edit-vaccinationStatus",
    "edit-pregnant",
    "edit-surveillanceType",
    "edit-notificationDate",
  ]);
  expect(
    screen.getByLabelText(/caseDetails.fields.diagnosisType/),
  ).toHaveAccessibleName("caseDetails.fields.diagnosisType");
  expect(
    screen.getByLabelText("caseDetails.fields.origin"),
  ).toBeInTheDocument();
});

it.each([["M", 30, false], ["F", 9, false], ["F", 10, true], ["F", 55, true], ["F", 56, false]])(
  "only renders pregnancy when applicable: %s, %s", async (patientSex, patientAge, eligible) => {
    vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, patientSex: String(patientSex), patientAge: Number(patientAge) });
    mount("edit");
    await screen.findByLabelText("caseDetails.fields.origin");
    const field = screen.queryByLabelText("fields.pregnant");
    if (eligible) expect(field).toBeEnabled();
    else expect(field).not.toBeInTheDocument();
  },
);

it("requires habitual residence on legacy cases and saves the selected code", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, habitualResidence: null });
  mount("edit");
  const field = await screen.findByLabelText(/caseDetails.fields.habitualResidence/);
  expect(field).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(await screen.findByText("validation.required")).toBeInTheDocument();
  expect(updateSurveillanceCase).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(updateSurveillanceCase).toHaveBeenCalledWith(record.uuid, expect.objectContaining({ habitualResidence: "3" })));
});

it("hides inapplicable view fields and renders null values with an em dash", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record,
    patientSex: "M", patientAge: null, patientDeathDate: null,
    providerDisplay: null, locationDisplay: null, habitualResidence: null,
    notificationDate: null, patientResidence: null,
    encounterDate: "2026-09-02T02:30:00Z",
  } as unknown as SurveillanceCase);
  mount("view");
  await screen.findByText(/01\/09\/2026 21:30/);
  expect(screen.queryByText("fields.pregnant")).not.toBeInTheDocument();
  expect(screen.queryByText("caseDetails.fields.deathAttribution")).not.toBeInTheDocument();
  for (const key of ["casesTable.age", "caseDetails.residence", "caseDetails.fields.providerUuid", "caseDetails.fields.locationUuid", "caseDetails.fields.habitualResidence", "caseDetails.fields.notificationDate"])
    expect(screen.getByText(key).nextElementSibling).toHaveTextContent("\u2014");
});
it("shows applicable pregnancy and death attribution in view mode", async () => {
  vi.mocked(getSurveillanceCase).mockResolvedValue({ ...record, pregnant: true,
    diagnosisType: "CONFIRMADO", patientDeathDate: "2026-09-01", deathAttribution: "SI" });
  mount("view");
  expect(await screen.findByText("fields.pregnant")).toBeInTheDocument();
  expect(screen.getByText("caseDetails.fields.deathAttribution")).toBeInTheDocument();
});
