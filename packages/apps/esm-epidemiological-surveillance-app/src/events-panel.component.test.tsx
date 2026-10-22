import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
      icd10: "A90",
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

it("combines disease and periodicity filters and restores all events", async () => {
  const event = { referenceRegulation: "NTS", validFrom: "2026-01-01" };
  vi.mocked(getEvents).mockResolvedValue([
    {
      ...event,
      uuid: "a",
      conceptUuid: "dengue",
      conceptDisplay: "Dengue",
      periodicity: "SEMANAL",
    },
    {
      ...event,
      uuid: "b",
      conceptUuid: "malaria",
      conceptDisplay: "Malaria",
      periodicity: "INMEDIATA",
    },
  ]);
  render(<EventsPanel />);
  const table = await screen.findByRole("table");
  expect(
    screen.queryByRole("option", { name: "Diaria" }),
  ).not.toBeInTheDocument();
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Enfermedad"), {
    target: { value: "dengue" },
  });
  expect(within(table).getByText("Dengue")).toBeInTheDocument();
  expect(within(table).queryByText("Malaria")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Periodicidad"), {
    target: { value: "INMEDIATA" },
  });
  expect(within(table).queryByText("Dengue")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Enfermedad"), {
    target: { value: "" },
  });
  expect(within(table).getByText("Malaria")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Periodicidad"), {
    target: { value: "" },
  });
  expect(within(table).getAllByRole("row")).toHaveLength(3);
});

it("edits every event attribute and refreshes the catalogue", async () => {
  const onEventsChanged = vi.fn();
  render(<EventsPanel onEventsChanged={onEventsChanged} />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
  expect(
    screen.getByLabelText(/Enfermedad \(Concepto\)/i, { selector: "input" }),
  ).toHaveValue("A90 - Dengue");
  expect(screen.getByLabelText(/Norma de referencia/i)).toHaveValue("NTS");
  expect(screen.getByLabelText(/^Estado/)).toHaveValue("active");
  fireEvent.change(
    screen.getByLabelText(/Enfermedad \(Concepto\)/i, { selector: "input" }),
    { target: { value: "Malaria" } },
  );
  fireEvent.click(await screen.findByText("Malaria"));
  fireEvent.change(
    within(screen.getByRole("dialog")).getByLabelText(/Periodicidad/),
    {
      target: { value: "INMEDIATA" },
    },
  );
  fireEvent.change(screen.getByLabelText(/Norma de referencia/i), {
    target: { value: "NTS actualizada" },
  });
  fireEvent.change(screen.getByLabelText(/^Estado/), {
    target: { value: "inactive" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await waitFor(() =>
    expect(updateEvent).toHaveBeenCalledWith("event-1", {
      conceptUuid: "concept-2",
      periodicity: "INMEDIATA",
      referenceRegulation: "NTS actualizada",
      active: false,
    }),
  );
  expect(saveEvent).not.toHaveBeenCalled();
  await waitFor(() => expect(onEventsChanged).toHaveBeenCalledOnce());
  expect(getEvents).toHaveBeenCalledTimes(2);
});

it("cancels edits without saving and resets the creation form", async () => {
  render(<EventsPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
  fireEvent.change(
    within(screen.getByRole("dialog")).getByLabelText(/Periodicidad/),
    {
      target: { value: "INMEDIATA" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: /Cancelar|Cancel/i }));
  expect(updateEvent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText(/Nuevo evento|New event/i));
  expect(
    within(screen.getByRole("dialog")).getByLabelText(/Periodicidad/),
  ).toHaveValue("SEMANAL");
  expect(screen.getByLabelText(/Norma de referencia/i)).toHaveValue("");
});

it("reactivates an inactive event", async () => {
  const event = (await getEvents())[0];
  vi.mocked(getEvents).mockResolvedValue([{ ...event, active: false }]);
  render(<EventsPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
  fireEvent.change(screen.getByLabelText(/^Estado/), {
    target: { value: "active" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await waitFor(() =>
    expect(updateEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ active: true }),
    ),
  );
});

it("keeps edits after a rejected save and allows retrying", async () => {
  vi.mocked(updateEvent).mockRejectedValueOnce({ code: "INVALID_EVENT" });
  const onEventsChanged = vi.fn();
  render(<EventsPanel onEventsChanged={onEventsChanged} />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
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

it("keeps inactive events editable but excludes them from the disease filter", async () => {
  const event = (await getEvents())[0];
  vi.mocked(getEvents).mockResolvedValue([{ ...event, active: false }]);
  render(<EventsPanel />);
  await screen.findByRole("button", { name: "Editar" });
  expect(
    within(screen.getByLabelText("Enfermedad")).queryByRole("option", {
      name: "Dengue",
    }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "Inactivo" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(screen.queryByLabelText(/Vigente/i)).not.toBeInTheDocument();
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
    "Estado",
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
  await screen.findByText("Evento 1", { selector: "td" });
  expect(
    screen.queryByText("Evento 11", { selector: "td" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(screen.getByText("Evento 11", { selector: "td" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Página siguiente" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(
    screen.getByLabelText(/Enfermedad \(Concepto\)/i, { selector: "input" }),
  ).toHaveValue("A90 - Evento 11");
  fireEvent.click(screen.getByRole("button", { name: /Cancelar|Cancel/i }));
  fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
  expect(screen.getByText("Evento 1", { selector: "td" })).toBeInTheDocument();
});

it("creates an active event with regulation", async () => {
  render(<EventsPanel />);
  await screen.findByText("Dengue", { selector: "td" });
  fireEvent.click(screen.getByText(/Nuevo evento|New event/i));
  expect(
    within(screen.getByRole("dialog")).getByRole("option", { name: "Semanal" }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("dialog")).getByRole("option", {
      name: "Inmediata",
    }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("dialog")).queryByRole("option", {
      name: "Diaria",
    }),
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
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await waitFor(() =>
    expect(saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        conceptUuid: "concept-2",
        periodicity: "SEMANAL",
        referenceRegulation: "NTS 228",
        active: true,
      }),
    ),
  );
});

it("shows only the violated reference condition below its input", async () => {
  render(<EventsPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
  const field = screen.getByLabelText(/Norma de referencia/i);
  fireEvent.change(field, { target: { value: "x".repeat(101) } });
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(field).toHaveAccessibleErrorMessage("validation.referenceLength");
  expect(
    screen.queryByText("Could not complete the operation"),
  ).not.toBeInTheDocument();
  expect(updateEvent).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: "" } });
  expect(field).toHaveAccessibleErrorMessage("validation.required");
  expect(
    screen.queryByText("validation.referenceLength"),
  ).not.toBeInTheDocument();
});

it("places a server condition under its corresponding field", async () => {
  vi.mocked(updateEvent).mockRejectedValueOnce({
    code: "INVALID_EVENT",
    fields: ["referenceRegulation"],
    fieldErrors: { referenceRegulation: "referenceLength" },
  });
  render(<EventsPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await screen.findByText("validation.referenceLength");
  expect(screen.getByLabelText(/Norma de referencia/i)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(
    screen.queryByText("Could not complete the operation"),
  ).not.toBeInTheDocument();
});
