import { expect, it } from "vitest";
import { patientAge } from "./case-form.utils";
it("calculates completed years, not simply the difference between years", () => {
  expect(patientAge("2000-10-01", "2026-09-30")).toBe(25);
  expect(patientAge("2000-09-30", "2026-09-30")).toBe(26);
  expect(patientAge("2026-09-29", "2026-09-30")).toBe(0);
});
it.each([undefined, "2000", "2000-02-30", "2030-01-01"])(
  "does not invent an age for %s",
  (birth) => {
    expect(patientAge(birth, "2026-09-30")).toBeUndefined();
  },
);
