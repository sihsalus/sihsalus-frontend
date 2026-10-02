import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getEvents, saveEvent, updateEvent, searchConcepts } from "./api";
import { EventsPanel } from "./events-panel.component";

vi.mock("./api", () => ({
  getEvents: vi.fn(),
  saveEvent: vi.fn(),
  updateEvent: vi.fn(),
  safeError: (error: unknown) => error,
  searchConcepts: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEvents).mockResolvedValue([
    {
      uuid: "event-1",
      conceptUuid: "concept-1",
      conceptDisplay: "Dengue",
      periodicity: "SEMANAL",
      referenceRegulation: "NTS",
      validFrom: "2026-01-01",
      validTo: null,
    },
  ]);
  vi.mocked(searchConcepts).mockResolvedValue([
    { uuid: "concept-2", display: "Malaria" },
  ]);
  vi.mocked(saveEvent).mockResolvedValue({
    uuid: "event-2",
    conceptUuid: "concept-2",
    conceptDisplay: "Malaria",
    periodicity: "SEMANAL",
    referenceRegulation: "NTS",
    validFrom: "2026-02-01",
  });
});

it("edits every event attribute and refreshes the catalogue", async () => {
  const onEventsChanged = vi.fn();
  render(<EventsPanel onEventsChanged={onEventsChanged} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Editar" }),
  );
  expect(
    screen.getByLabelText(/Enfermedad \(Concepto\)/i, { selector: "input" }),
  ).toHaveValue("Dengue");
  expect(screen.getByLabelText(/Norma de referencia/i)).toHaveValue("NTS");
  expect(screen.getByLabelText(/Vigente desde/i)).toHaveValue("2026-01-01");
  fireEvent.change(
    screen.getByLabelText(/Enfermedad \(Concepto\)/i, { selector: "input" }),
    { target: { value: "Malaria" } },
  );
  fireEvent.click(await screen.findByText("Malaria"));
  fireEvent.change(screen.getByLabelText("Periodicidad"), {
    target: { value: "INMEDIATA" },
  });
  fireEvent.change(screen.getByLabelText(/Norma de referencia/i), {
    target: { value: "NTS actualizada" },
  });
  fireEvent.change(screen.getByLabelText(/Vigente desde/i), {
    target: { value: "2026-02-01" },
  });
  fireEvent.change(screen.getByLabelText(/Vigente hasta/i), {
    target: { value: "2026-12-31" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await waitFor(() =>
    expect(updateEvent).toHaveBeenCalledWith("event-1", {
      conceptUuid: "concept-2",
      periodicity: "INMEDIATA",
      referenceRegulation: "NTS actualizada",
      validFrom: "2026-02-01",
      validTo: "2026-12-31",
    }),
  );
  expect(saveEvent).not.toHaveBeenCalled();
  await waitFor(() => expect(onEventsChanged).toHaveBeenCalledOnce());
  expect(getEvents).toHaveBeenCalledTimes(2);
});

it("cancels edits without saving and resets the creation form", async () => {
  render(<EventsPanel />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Editar" }),
  );
  fireEvent.change(screen.getByLabelText("Periodicidad"), {
    target: { value: "INMEDIATA" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Cancelar|Cancel/i }));
  expect(updateEvent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText(/Nueva versión|New event/i));
  expect(screen.getByLabelText("Periodicidad")).toHaveValue("SEMANAL");
  expect(screen.getByLabelText(/Norma de referencia/i)).toHaveValue("");
});

it("allows clearing the end date", async () => {
  const event = (await getEvents())[0];
  vi.mocked(getEvents).mockResolvedValue([{ ...event, validTo: "2026-12-31" }]);
  render(<EventsPanel />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Editar" }),
  );
  fireEvent.change(screen.getByLabelText(/Vigente hasta/i), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await waitFor(() =>
    expect(updateEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ validTo: null }),
    ),
  );
});

it("keeps edits after a rejected save and allows retrying", async () => {
  vi.mocked(updateEvent).mockRejectedValueOnce({ code: "INVALID_EVENT" });
  const onEventsChanged = vi.fn();
  render(<EventsPanel onEventsChanged={onEventsChanged} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Editar" }),
  );
  fireEvent.change(screen.getByLabelText(/Norma de referencia/i), {
    target: { value: "NTS corregida" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await screen.findByText("Could not complete the operation");
  expect(screen.getByLabelText(/Norma de referencia/i)).toHaveValue(
    "NTS corregida",
  );
  expect(onEventsChanged).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await waitFor(() => expect(onEventsChanged).toHaveBeenCalledOnce());
});

it("rejects an end date before the start without sending an update", async () => {
  render(<EventsPanel />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Editar" }),
  );
  fireEvent.change(screen.getByLabelText(/Vigente hasta/i), {
    target: { value: "2025-12-31" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await screen.findByText("Could not complete the operation");
  expect(updateEvent).not.toHaveBeenCalled();
});

it("shows translated event attributes in a Carbon table", async () => {
  render(<EventsPanel />);
  const table = await screen.findByRole("table", {
    name: "Eventos notificables",
  });
  expect(table).toHaveClass("cds--data-table");
  for (const name of [
    "Enfermedad (Concepto)",
    "Periodicidad",
    "Norma de referencia",
    "Vigente desde",
    "Vigente hasta",
  ]) {
    expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
  }
  expect(screen.getByRole("cell", { name: "Semanal" })).toBeInTheDocument();
});

it("paginates events and opens the selected event on the second page", async () => {
  const template = (await getEvents())[0];
  vi.mocked(getEvents).mockResolvedValue(
    Array.from({ length: 11 }, (_, index) => ({
      ...template,
      uuid: `event-${index + 1}`,
      conceptDisplay: `Evento ${index + 1}`,
    })),
  );
  render(<EventsPanel />);
  await screen.findByText("Evento 1");
  expect(screen.queryByText("Evento 11")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(screen.getByText("Evento 11")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Página siguiente" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Editar" }),
  );
  expect(
    screen.getByLabelText(/Enfermedad \(Concepto\)/i, { selector: "input" }),
  ).toHaveValue("Evento 11");
  fireEvent.click(screen.getByRole("button", { name: /Cancelar|Cancel/i }));
  fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
  expect(screen.getByText("Evento 1")).toBeInTheDocument();
});

it("creates an event version with regulation and validity", async () => {
  render(<EventsPanel />);
  await screen.findByText("Dengue");
  fireEvent.click(screen.getByText(/Nueva versión|New event/i));
  expect(screen.getByRole("option", { name: "Semanal" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Inmediata" })).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Diaria" }),
  ).not.toBeInTheDocument();
  fireEvent.change(
    screen.getByLabelText(/Enfermedad \(Concepto\)/i, { selector: "input" }),
    { target: { value: "Malaria" } },
  );
  await waitFor(() => expect(searchConcepts).toHaveBeenCalled());
  fireEvent.click(screen.getByText("Malaria"));
  fireEvent.change(screen.getByLabelText(/Norma de referencia/i), {
    target: { value: "NTS 228" },
  });
  fireEvent.change(screen.getByLabelText(/Vigente desde/i), {
    target: { value: "2026-02-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await waitFor(() =>
    expect(saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        conceptUuid: "concept-2",
        periodicity: "SEMANAL",
        referenceRegulation: "NTS 228",
        validFrom: "2026-02-01",
      }),
    ),
  );
});
