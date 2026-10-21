import { expect, it } from "vitest";
import { displayDateTime } from "./date-display";
it.each([
  ["2026-09-02T02:30:00Z", "01/09/2026 21:30"],
  ["2026-09-02T02:30:00+0000", "01/09/2026 21:30"],
  ["2026-09-01T21:30:00-05:00", "01/09/2026 21:30"],
  ["2026-01-01T01:00:00Z", "31/12/2025 20:00"],
  ["2026-09-01 23:00:31.0", "01/09/2026 18:00"],
  [null, ""],
  ["invalid", ""],
])("formats %s at UTC-5", (input, expected) => {
  expect(displayDateTime(input)).toBe(expected);
});
