import { expect, it } from "vitest";
import { caseDateErrors, serverFieldErrors } from "./field-validation";
import { safeError } from "./api";

it("reports the specific violated condition for each date", () => {
  const dates = { investigationDate: "2026-01-20", onsetDate: "2026-01-19" };
  expect(
    caseDateErrors({ ...dates, notificationDate: "2026-01-21T12:00:00-05:00" }, "2026-01-20"),
  ).toEqual({ notificationDate: "future" });
  expect(
    caseDateErrors({ ...dates, notificationDate: "2026-01-19T12:00:00-05:00" }, "2026-01-20"),
  ).toEqual({ notificationDate: "notificationBeforeInvestigation" });
  expect(
    caseDateErrors({ ...dates, onsetDate: "2026-02-30" }, "2026-01-20"),
  ).toEqual({ onsetDate: "dateFormat" });
  expect(
    caseDateErrors({ ...dates, notificationDate: "2026-01-20T12:00:00-05:00" }, "2026-01-20"),
  ).toEqual({});
});

it("keeps only known field names and condition codes from server errors", () => {
  const error = safeError({
    status: 422,
    responseBody: {
      code: "INVALID_DATE_RANGE",
      fields: ["notificationDate", "sensitive-value"],
      fieldErrors: {
        notificationDate: "future",
        onsetDate: "sensitive-value",
        "sensitive-value": "future",
      },
    },
  });
  expect(error.fields).toEqual(["notificationDate"]);
  expect(serverFieldErrors(error)).toEqual({ notificationDate: "future" });
  expect(
    serverFieldErrors(
      safeError({
        status: 409,
        responseBody: {
          code: "CASE_ALREADY_EXISTS_FOR_DIAGNOSIS",
          fields: ["diagnosisUuid"],
        },
      }),
      true,
    ),
  ).toEqual({ eventUuid: "duplicateDiagnosis" });
});
