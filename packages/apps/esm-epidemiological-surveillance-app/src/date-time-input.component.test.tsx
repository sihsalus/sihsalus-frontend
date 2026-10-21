import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DateTimeInput } from "./date-time-input.component";
import { caseDateErrors } from "./field-validation";
it("edits notification in UTC-5 and includes the offset in the saved value", () => {
  const change = vi.fn();
  render(<DateTimeInput id="time" labelText="Notification" value="2026-01-22T04:35:12Z" onChange={change} />);
  expect(screen.getByLabelText("Notification")).toHaveValue("2026-01-21T23:35:12");
  fireEvent.change(screen.getByLabelText("Notification"), { target: { value: "2026-01-22T08:30" } });
  expect(change).toHaveBeenCalledWith({ target: { value: "2026-01-22T08:30-05:00" } });
});
it("rejects a notification before the exact encounter time", () => {
  expect(caseDateErrors({ investigationDate: "2026-01-20", notificationDate: "2026-01-20T08:59:00-05:00" },
    "2026-01-21", undefined, "2026-01-20T14:00:00Z")).toEqual({ notificationDate: "notificationBeforeInvestigation" });
  expect(caseDateErrors({ investigationDate: "2026-01-20", notificationDate: "2026-01-20T09:00:00-05:00" },
    "2026-01-21", undefined, "2026-01-20T14:00:00Z")).toEqual({});
});
