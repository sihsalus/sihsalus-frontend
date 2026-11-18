import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { listSurveillanceCases, searchPatients } from "./api";
import { CasesPanel } from "./cases-panel.component";
import { catalogue } from "./test-fixtures";
import type { FhirResource, SurveillanceCase } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === "string" ? fallback : key),
  }),
}));
vi.mock("@openmrs/esm-framework", () => ({ openmrsFetch: vi.fn(), restBaseUrl: "/ws/rest/v1" }));
vi.mock("./api", () => ({ listSurveillanceCases: vi.fn(), searchPatients: vi.fn() }));
vi.mock("@sihsalus/esm-rbac", () => ({
  RequirePrivilege: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">Safe error</p>,
}));
vi.mock("./case-modal.component", () => ({
  CaseModal: ({ mode, onClose, onSaved }: { mode: string; onClose: () => void; onSaved: () => void }) => (
    <div>
      <span>Modal {mode}</span>
      <button type="button" onClick={onClose}>
        Close modal
      </button>
      <button type="button" onClick={onSaved}>
        Save modal
      </button>
    </div>
  ),
}));

const row = {
  uuid: "synthetic-case",
  patientIdentifier: "TEST-001",
  patientDisplay: "Paciente Sintético",
  patientSex: "F",
  diagnosisDisplay: "Diagnóstico de prueba",
  onsetDate: "2026-09-01",
  notificationDate: "2026-09-02",
} as SurveillanceCase;
const patient = {
  resourceType: "Patient",
  id: "patient-1",
  name: [{ given: ["Ana"], family: "Prueba" }],
  identifier: [{ value: "12345678", type: { text: "DNI" } }],
} as FhirResource;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listSurveillanceCases).mockResolvedValue([row]);
  vi.mocked(searchPatients).mockResolvedValue([patient]);
});

it("shows a safe error when cases cannot be listed", async () => {
  vi.mocked(listSurveillanceCases).mockRejectedValue(new Error("offline"));
  render(<CasesPanel catalogue={catalogue} revision={0} onNewCase={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Safe error");
});

it("applies every filter, including a searched patient", async () => {
  render(<CasesPanel catalogue={catalogue} revision={0} onNewCase={vi.fn()} />);
  await screen.findByRole("table", { name: "Casos registrados" });
  const combo = screen.getByRole("combobox", { name: /Paciente/ });
  fireEvent.change(combo, { target: { value: "Ana" } });
  await waitFor(() => expect(searchPatients).toHaveBeenCalledWith("Ana"));
  fireEvent.click(await screen.findByText(/Ana Prueba · DNI: 12345678/));
  fireEvent.change(screen.getByLabelText("Diagnóstico"), {
    target: { value: catalogue.events[0].conceptUuid },
  });
  fireEvent.change(screen.getByLabelText("Inicio de síntomas hasta"), {
    target: { value: "10/09/2026" },
  });
  fireEvent.change(screen.getByLabelText("Notificación desde"), {
    target: { value: "01/09/2026" },
  });
  fireEvent.change(screen.getByLabelText("Notificación hasta"), {
    target: { value: "11/09/2026" },
  });
  fireEvent.change(screen.getByLabelText("Fallecimiento registrado"), {
    target: { value: "true" },
  });
  await waitFor(() =>
    expect(listSurveillanceCases).toHaveBeenLastCalledWith(
      expect.objectContaining({
        patient: "patient-1",
        onsetTo: "2026-09-10",
        notificationFrom: "2026-09-01",
        notificationTo: "2026-09-11",
        fatal: "true",
      }),
    ),
  );
});

it("opens a case for viewing and editing and refreshes after saving", async () => {
  const onSaved = vi.fn();
  render(<CasesPanel catalogue={catalogue} revision={0} onNewCase={vi.fn()} onSaved={onSaved} />);
  fireEvent.click(await screen.findByRole("button", { name: "Ver caso" }));
  expect(screen.getByText("Modal view")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
  expect(screen.queryByText("Modal view")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(screen.getByText("Modal edit")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save modal" }));
  expect(onSaved).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(listSurveillanceCases).toHaveBeenCalledTimes(2));
});
