import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getEvents, saveEvent, searchConcepts } from "./api";
import { EventsPanel } from "./events-panel.component";

vi.mock("./api", () => ({ getEvents: vi.fn(), saveEvent: vi.fn(), searchConcepts: vi.fn() }));

beforeEach(() => {
  vi.mocked(getEvents).mockResolvedValue([{ uuid: "event-1", conceptUuid: "concept-1", conceptDisplay: "Dengue", periodicity: "SEMANAL", referenceRegulation: "NTS", validFrom: "2026-01-01", validTo: null }]);
  vi.mocked(searchConcepts).mockResolvedValue([{ uuid: "concept-2", display: "Malaria" }]);
  vi.mocked(saveEvent).mockResolvedValue({ uuid: "event-2", conceptUuid: "concept-2", conceptDisplay: "Malaria", periodicity: "DIARIA", referenceRegulation: "NTS", validFrom: "2026-02-01" });
});

it("creates an event version with regulation and validity", async () => {
  render(<EventsPanel />);
  await screen.findByText("Dengue");
  fireEvent.click(screen.getByText(/Nueva versión|New event/i));
  fireEvent.change(screen.getByLabelText(/Enfermedad \(Concepto\)/i, { selector: "input" }), { target: { value: "Malaria" } });
  await waitFor(() => expect(searchConcepts).toHaveBeenCalled());
  fireEvent.click(screen.getByText("Malaria"));
  fireEvent.change(screen.getByLabelText(/Norma de referencia/i), { target: { value: "NTS 228" } });
  fireEvent.change(screen.getByLabelText(/Vigente desde/i), { target: { value: "2026-02-01" } });
  fireEvent.click(screen.getByRole("button", { name: /Guardar|Save/i }));
  await waitFor(() => expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ conceptUuid: "concept-2", periodicity: "SEMANAL", referenceRegulation: "NTS 228", validFrom: "2026-02-01" })));
});
