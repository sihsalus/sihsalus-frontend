import type { Diagnosis } from "../types";
import {
  reconcileEncounterDiagnoses,
  reconcileObservation,
} from "./visit-note-submission";

const selected = (coded: string): Diagnosis => ({
  patient: "patient",
  diagnosis: { coded },
  certainty: "PROVISIONAL",
  rank: 1,
  display: coded,
});

test("updates the owned canonical obs, voids duplicates and preserves a foreign namespace", () => {
  const existing = [
    {
      uuid: "keep",
      concept: { uuid: "question" },
      formFieldNamespace: "visit-notes",
      formFieldPath: "plan",
    },
    {
      uuid: "duplicate",
      concept: { uuid: "question" },
      formFieldNamespace: "visit-notes",
      formFieldPath: "plan",
    },
    {
      uuid: "foreign",
      concept: { uuid: "question" },
      formFieldNamespace: "other-form",
      formFieldPath: "plan",
    },
  ];

  expect(reconcileObservation(existing, "question", "new", "plan")).toEqual([
    {
      uuid: "keep",
      concept: { uuid: "question", display: "" },
      value: "new",
      formFieldNamespace: "visit-notes",
      formFieldPath: "plan",
    },
    { uuid: "duplicate", voided: true },
  ]);
});

test("clearing a field voids its canonical and explicit legacy aliases only", () => {
  const existing = [
    { uuid: "canonical", concept: { uuid: "new-question" } },
    { uuid: "legacy", concept: { uuid: "old-question" } },
    {
      uuid: "foreign",
      concept: { uuid: "old-question" },
      formFieldNamespace: "another-form",
    },
  ];

  expect(
    reconcileObservation(existing, "new-question", "", undefined, [
      { conceptUuid: "old-question" },
    ]),
  ).toEqual([
    { uuid: "canonical", voided: true },
    { uuid: "legacy", voided: true },
  ]);
});

test("reconciles retained, new, duplicate and removed diagnoses atomically", () => {
  expect(
    reconcileEncounterDiagnoses(
      [selected("retained"), selected("new")],
      [
        { uuid: "retained-1", diagnosis: { coded: { uuid: "retained" } } },
        { uuid: "retained-2", diagnosis: { coded: { uuid: "retained" } } },
        { uuid: "removed", diagnosis: { coded: { uuid: "removed" } } },
      ],
      { retained: "definitive" },
      "presumptive",
      "definitive",
      "patient",
    ),
  ).toEqual([
    expect.objectContaining({
      uuid: "retained-1",
      certainty: "CONFIRMED",
      diagnosis: { coded: "retained" },
    }),
    expect.objectContaining({
      certainty: "PROVISIONAL",
      diagnosis: { coded: "new" },
    }),
    { uuid: "retained-2", voided: true },
    { uuid: "removed", voided: true },
  ]);
});
