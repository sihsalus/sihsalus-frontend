import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TravelHistory } from "./travel-history.component";
import { travelHistoryErrors, serverFieldErrors } from "./field-validation";
import { toSurveillanceCaseDraft, validateCase } from "./case-form.utils";
import { caseUpdatePayload } from "./case-modal.component";
import { catalogue, request } from "./test-fixtures";
import type { TravelHistoryEntry } from "./types";
import en from "../translations/en.json";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: { number: number }) => {
  let text: unknown = en;
  for (const part of key.split(".")) text = (text as Record<string, unknown>)?.[part];
  return typeof text === "string" ? text.replace("{{number}}", String(options?.number)) : key;
} }) }));
vi.mock("./infection-address.resource", () => ({ searchInfectionAddresses: vi.fn(async () => []) }));
const trip: TravelHistoryEntry = { uuid: "trip-1", travelAddress: "center", travelAddressDisplay: "Synthetic village", startDate: "2026-01-01", endDate: "2026-01-02" };
function Editor({ initial = [] }: { initial?: TravelHistoryEntry[] }) {
  const [value, setValue] = useState(initial);
  return <TravelHistory value={value} onChange={setValue} today="2026-01-20" />;
}
describe("travel history", () => {
  it("starts empty and adds/removes independent rows with unique input IDs", () => {
    render(<Editor />);
    expect(screen.queryByText("Trip 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add trip" }));
    fireEvent.click(screen.getByRole("button", { name: "Add trip" }));
    const starts = screen.getAllByLabelText("Start date");
    expect(starts[0].id).not.toBe(starts[1].id);
    fireEvent.change(starts[1], { target: { value: "02/01/2026" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Remove trip" })[0]);
    expect(screen.getByLabelText("Start date")).toHaveValue("02/01/2026");
    fireEvent.click(screen.getByRole("button", { name: "Remove trip" }));
    expect(screen.queryByLabelText("Start date")).not.toBeInTheDocument();
  });
  it("loads existing rows for editing and displays full details in consultation", () => {
    const { unmount } = render(<Editor initial={[trip]} />);
    expect(screen.getByLabelText("Start date")).toHaveValue("01/01/2026");
    expect(screen.getByText("Synthetic village")).toBeInTheDocument();
    unmount(); render(<TravelHistory value={[trip]} />);
    expect(screen.getByText("Synthetic village")).toBeInTheDocument();
    expect(screen.getByText("01/01/2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add trip" })).not.toBeInTheDocument();
  });
  it("places validation feedback inside the affected row", () => {
    render(<TravelHistory value={[trip, { ...trip, uuid: "trip-2", endDate: "" }]} onChange={() => {}}
      errors={{ "travelHistory[1].endDate": "required" }} />);
    expect(within(screen.getByRole("group", { name: "Trip 2" })).getByText(en.validation.required)).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Trip 1" })).queryByText(en.validation.required)).not.toBeInTheDocument();
  });
  it("keeps UUIDs but excludes display and client metadata from POST and PUT", () => {
    const entry = { ...trip, clientKey: "local" };
    const payload = toSurveillanceCaseDraft({ ...request, travelHistory: [entry] }, "diagnosis");
    expect(payload.travelHistory).toEqual([{ uuid: "trip-1", travelAddress: "center", startDate: "2026-01-01", endDate: "2026-01-02" }]);
    expect(caseUpdatePayload({ ...payload, travelHistory: [entry] }).travelHistory).toEqual(payload.travelHistory);
    expect(caseUpdatePayload({ ...payload, travelHistory: [] }).travelHistory).toEqual([]);
  });
  it("accepts an optional empty list and no onset date", () => {
    expect(travelHistoryErrors({}, "2026-01-20")).toEqual({});
    expect(validateCase({ ...request, onsetDate: undefined }, catalogue.catalog)).not.toContain("onsetDate");
  });
  it.each([
    [{ travelAddress: "" }, "travelAddress", "required"],
    [{ startDate: "" }, "startDate", "required"],
    [{ endDate: "" }, "endDate", "required"],
    [{ startDate: "2026-02-30" }, "startDate", "dateFormat"],
    [{ startDate: "2026-01-03" }, "endDate", "endBeforeStart"],
    [{ startDate: "2026-01-21" }, "startDate", "future"],
    [{ endDate: "2026-01-21" }, "endDate", "future"],
    [{ startDate: "2025-12-01", endDate: "2025-12-21" }, "startDate", "travelOutsideWindow"],
    [{ startDate: "2026-01-20", endDate: "2026-01-20" }, "startDate", "travelOutsideWindow"],
  ])("validates %j", (patch, field, reason) => {
    const errors = travelHistoryErrors({ onsetDate: "2026-01-19", travelHistory: [{ ...trip, ...patch }] }, "2026-01-20");
    expect(errors[`travelHistory[0].${field}`]).toBe(reason);
  });
  it.each([["2025-12-22", "2025-12-22"], ["2025-11-01", "2025-12-22"], ["2026-01-19", "2026-01-19"], ["2025-11-01", "2026-01-20"]])("accepts intersection %s to %s", (startDate, endDate) => {
    expect(travelHistoryErrors({ onsetDate: "2026-01-19", travelHistory: [{ ...trip, startDate, endDate }] }, "2026-01-20")).toEqual({});
  });
  it("uses the care date only when onset is absent", () => {
    const value = { investigationDate: "2026-01-20", travelHistory: [{ ...trip, startDate: "2025-12-22", endDate: "2025-12-22" }] };
    expect(travelHistoryErrors(value, "2026-01-20")["travelHistory[0].startDate"]).toBe("travelOutsideWindow");
    expect(travelHistoryErrors({ ...value, onsetDate: "2026-01-19" }, "2026-01-20")).toEqual({});
  });
  it("preserves row-specific server validation", () => {
    expect(serverFieldErrors({ fields: ["travelHistory[2].endDate"], code: "INVALID_DATE_RANGE", fieldErrors: { "travelHistory[2].endDate": "endBeforeStart" } }))
      .toEqual({ "travelHistory[2].endDate": "endBeforeStart" });
  });
});
