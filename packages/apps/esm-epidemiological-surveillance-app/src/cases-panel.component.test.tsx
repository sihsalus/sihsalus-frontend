import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { listSurveillanceCases } from "./api";
import { CasesPanel } from "./cases-panel.component";
import type { Catalogue, SurveillanceCase } from "./types";

vi.mock("./api", () => ({
  listSurveillanceCases: vi.fn(),
  searchPatients: vi.fn(),
}));
const catalogue = { events: [] } as unknown as Catalogue;

beforeEach(() => vi.mocked(listSurveillanceCases).mockResolvedValue([]));

it("uses a Carbon table with separate patient, diagnosis, date and action columns", async () => {
  vi.mocked(listSurveillanceCases).mockResolvedValue([
    {
      uuid: "synthetic-case",
      patientIdentifier: "TEST-001",
      patientDisplay: "Paciente Sintético",
      patientSex: "F",
      diagnosisDisplay: "Diagnóstico de prueba",
      onsetDate: "2026-09-01",
      notificationDate: "2026-09-02",
      deathDate: "2026-09-03",
    } as SurveillanceCase,
  ]);
  render(<CasesPanel catalogue={catalogue} revision={0} onNewCase={vi.fn()} />);
  const table = await screen.findByRole("table", { name: "Casos registrados" });
  expect(table).toHaveClass("cds--data-table");
  expect(screen.getAllByRole("columnheader")).toHaveLength(8);
  expect(
    screen.getByRole("cell", { name: "Paciente Sintético" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "Femenino" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ver caso" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
});

it("shows an explicit empty result instead of a blank table", async () => {
  render(<CasesPanel catalogue={catalogue} revision={0} onNewCase={vi.fn()} />);
  expect(
    await screen.findByText("No hay casos para los filtros seleccionados."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Página siguiente" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeDisabled();
});

it("paginates cases, changes page size and resets after filtering", async () => {
  const cases = Array.from(
    { length: 21 },
    (_, index) =>
      ({
        uuid: `case-${index}`,
        patientDisplay: `Paciente ${index + 1}`,
      }) as SurveillanceCase,
  );
  vi.mocked(listSurveillanceCases).mockResolvedValue(cases);
  render(<CasesPanel catalogue={catalogue} revision={0} onNewCase={vi.fn()} />);
  await screen.findByText("Paciente 1");
  expect(screen.queryByText("Paciente 11")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(screen.getByText("Paciente 11")).toBeInTheDocument();
  expect(screen.queryByText("Paciente 1")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filas por página:"), {
    target: { value: "20" },
  });
  expect(screen.getByText("Paciente 1")).toBeInTheDocument();
  expect(screen.getByText("Paciente 20")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(screen.getByText("Paciente 21")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Página siguiente" }),
  ).toBeDisabled();
  vi.mocked(listSurveillanceCases).mockResolvedValue([cases[0]]);
  fireEvent.change(screen.getByLabelText("Inicio de síntomas desde"), {
    target: { value: "2026-01-01" },
  });
  await screen.findByText("Paciente 1");
  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeDisabled();
});
