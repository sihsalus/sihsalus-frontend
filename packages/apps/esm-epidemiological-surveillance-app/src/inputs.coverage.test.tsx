import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getEvents, searchConcepts } from "./api";
import { DateInput } from "./date-input.component";
import { EventsPanel } from "./events-panel.component";
import { TravelHistory } from "./travel-history.component";

vi.mock("react-i18next", async () => {
  const es = (await import("../translations/es.json")).default as Record<string, unknown>;
  const t = (key: string) => {
    let text: unknown = es;
    for (const part of key.split(".")) text = (text as Record<string, unknown>)?.[part];
    return typeof text === "string" ? text : key;
  };
  return { useTranslation: () => ({ t }) };
});
vi.mock("@openmrs/esm-framework", () => ({ openmrsFetch: vi.fn(), restBaseUrl: "/ws/rest/v1", fhirBaseUrl: "/ws/fhir2/R4" }));
vi.mock("./api", () => ({
  getEvents: vi.fn(),
  saveEvent: vi.fn(),
  updateEvent: vi.fn(),
  safeError: (error: unknown) => error,
  searchConcepts: vi.fn(),
}));
vi.mock("./infection-address-selector.component", () => ({
  InfectionAddressSelector: ({ onChange }: { onChange: (value: string, display: string) => void }) => (
    <button type="button" onClick={() => onChange("place", "Synthetic place")}>pick-address</button>
  ),
}));

describe("input boundaries", () => {
  it("propagates a date chosen in the calendar as ISO", async () => {
    const change = vi.fn();
    const { container } = render(<DateInput id="picked" labelText="Picked" value="2026-10-14" onChange={change} />);
    fireEvent.click(screen.getByLabelText("Picked"));
    const day = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(".flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)");
      if (!found) throw new Error("Calendar day not rendered");
      return found;
    });
    fireEvent.click(day);
    await waitFor(() => expect(change).toHaveBeenCalledWith({ target: { value: expect.stringMatching(/^2026-10-\d{2}$/) } }));
    expect(container).toBeTruthy();
  });

  it("updates the infection place of a trip", () => {
    const change = vi.fn();
    render(
      <TravelHistory
        value={[{ uuid: "trip", travelAddress: "", travelAddressDisplay: "", startDate: "2026-01-01", endDate: "2026-01-02" }]}
        onChange={change}
        today="2026-01-20"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "pick-address" }));
    expect(change).toHaveBeenCalledWith([
      expect.objectContaining({ travelAddress: "place", travelAddressDisplay: "Synthetic place" }),
    ]);
  });

  it("clears concept suggestions when the concept search fails", async () => {
    vi.mocked(getEvents).mockResolvedValue([
      { uuid: "event-1", conceptUuid: "concept-1", conceptDisplay: "Dengue", icd10: "A90", periodicity: "SEMANAL", referenceRegulation: "NTS", validFrom: "2026-01-01", validTo: null },
    ] as never);
    vi.mocked(searchConcepts).mockRejectedValue(new Error("offline"));
    render(<EventsPanel onEventsChanged={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("combobox", { name: /^Enfermedad/ }), {
      target: { value: "Mala" },
    });
    await waitFor(() => expect(searchConcepts).toHaveBeenCalledWith("Mala"));
    expect(screen.queryByText("Malaria")).not.toBeInTheDocument();
  });

  it("lists events without a stored name or a known periodicity and restarts short searches", async () => {
    vi.mocked(getEvents).mockResolvedValue([
      { uuid: "event-9", conceptUuid: "concept-9", periodicity: "QUINCENAL", referenceRegulation: "NTS", validFrom: "2026-01-01", validTo: null },
    ] as never);
    vi.mocked(searchConcepts).mockResolvedValue([]);
    render(<EventsPanel onEventsChanged={vi.fn()} />);
    expect((await screen.findAllByText("concept-9")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("QUINCENAL").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const combo = within(screen.getByRole("dialog")).getByRole("combobox", { name: /^Enfermedad/ });
    fireEvent.change(combo, { target: { value: "Ma" } });
    fireEvent.change(combo, { target: { value: "M" } });
    fireEvent.change(combo, { target: { value: "Mal" } });
    await waitFor(() => expect(searchConcepts).toHaveBeenCalledWith("Mal"));
    expect(searchConcepts).toHaveBeenCalledTimes(1);
  });
});
