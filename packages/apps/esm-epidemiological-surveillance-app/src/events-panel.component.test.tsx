import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventsPanel } from "./events-panel.component";
import {
  deleteEvent,
  getEvents,
  saveEvent,
  searchConcepts,
  updateEvent,
} from "./api";
import { catalogue } from "./test-fixtures";
import type { SurveillanceEvent } from "./types";

vi.mock("./api", () => ({
  getEvents: vi.fn(),
  saveEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  searchConcepts: vi.fn(),
}));

const mockEvents: SurveillanceEvent[] = [
  {
    uuid: "event-1",
    name: "Dengue grave",
    conceptUuid: "concept-1",
    conceptDisplay: "Severe dengue",
    periodicity: "inmediata",
    deadlineDays: 1,
    retired: false,
  },
  {
    uuid: "event-2",
    name: "Malaria vivax",
    conceptUuid: "concept-2",
    conceptDisplay: "Malaria vivax infection",
    periodicity: "semanal",
    deadlineDays: 7,
    retired: true,
  },
];

describe("EventsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEvents).mockResolvedValue(mockEvents);
    vi.mocked(searchConcepts).mockResolvedValue([
      { uuid: "concept-new", display: "Chikungunya fever" },
    ]);
    vi.mocked(saveEvent).mockResolvedValue({
      uuid: "event-3",
      name: "Chikungunya",
      conceptUuid: "concept-new",
      conceptDisplay: "Chikungunya fever",
      periodicity: "semanal",
      deadlineDays: 7,
      retired: false,
    });
    vi.mocked(updateEvent).mockResolvedValue({
      ...mockEvents[0],
      name: "Dengue hemorrágico",
    });
    vi.mocked(deleteEvent).mockResolvedValue(undefined);
  });

  it("loads and displays events in the table", async () => {
    render(<EventsPanel catalogue={catalogue} />);

    await waitFor(() => {
      expect(screen.getByText("Dengue grave")).toBeInTheDocument();
    });
    expect(screen.getByText("Severe dengue")).toBeInTheDocument();
    expect(screen.getByText("Malaria vivax")).toBeInTheDocument();
    expect(getEvents).toHaveBeenCalledWith(false);
  });

  it("toggles including retired events", async () => {
    render(<EventsPanel catalogue={catalogue} />);

    await screen.findByText("Dengue grave");
    const toggleButton = screen.getByText(/Show retired|Mostrar retirados/i);
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(getEvents).toHaveBeenCalledWith(true);
    });
  });

  it("opens create modal and saves a new event", async () => {
    const onEventsChanged = vi.fn();
    render(<EventsPanel catalogue={catalogue} onEventsChanged={onEventsChanged} />);

    await screen.findByText("Dengue grave");
    const newEventBtn = screen.getByRole("button", { name: /New Event|Nuevo Evento/i });
    fireEvent.click(newEventBtn);

    expect(screen.getByRole("dialog", { name: /Nuevo evento|New event/i })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Event Name|Nombre del Evento/i);
    fireEvent.change(nameInput, { target: { value: "Chikungunya" } });

    // Search concepts
    const conceptInput = screen.getByPlaceholderText(/Search disease concept|Buscar concepto/i);
    fireEvent.change(conceptInput, { target: { value: "Chik" } });

    await waitFor(() => {
      expect(searchConcepts).toHaveBeenCalledWith("Chik");
    });

    await waitFor(() => {
      expect(screen.getByText("Chikungunya fever")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Chikungunya fever"));

    const submitBtn = within(screen.getByRole("dialog")).getByRole("button", {
      name: /Save|Guardar/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Chikungunya",
          conceptUuid: "concept-new",
          periodicity: "semanal",
          deadlineDays: 7,
        }),
      );
    });
  });

  it("opens edit modal and updates an event", async () => {
    const onEventsChanged = vi.fn();
    render(<EventsPanel catalogue={catalogue} onEventsChanged={onEventsChanged} />);

    await screen.findByText("Dengue grave");
    const editBtns = screen.getAllByRole("button", { name: /Edit|Editar/i });
    fireEvent.click(editBtns[0]);

    expect(screen.getByRole("dialog", { name: /Editar evento|Edit event/i })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Event Name|Nombre del Evento/i);
    fireEvent.change(nameInput, { target: { value: "Dengue hemorrágico" } });

    const saveBtn = within(screen.getByRole("dialog")).getByRole("button", {
      name: /Save|Guardar/i,
    });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith("event-1", expect.objectContaining({
        name: "Dengue hemorrágico",
      }));
    });
  });

  it("opens retire modal and retires an event", async () => {
    const onEventsChanged = vi.fn();
    render(<EventsPanel catalogue={catalogue} onEventsChanged={onEventsChanged} />);

    await screen.findByText("Dengue grave");
    const retireBtns = screen.getAllByRole("button", { name: /Retire|Retirar/i });
    fireEvent.click(retireBtns[0]);

    expect(screen.getByRole("dialog", { name: /Retirar evento|Retire event/i })).toBeInTheDocument();

    const confirmBtn = within(screen.getByRole("dialog")).getByRole("button", {
      name: /Retire|Retirar/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteEvent).toHaveBeenCalledWith("event-1");
    });
  });
});
