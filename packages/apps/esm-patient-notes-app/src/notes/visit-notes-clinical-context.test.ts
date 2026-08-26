import { openmrsFetch, useConfig } from "@openmrs/esm-framework";
import { renderHook, waitFor } from "@testing-library/react";

import type { ConfigObject } from "../config-schema";
import { defaultVisitNoteClinicalConceptUuids } from "./visit-note-config-schema";
import {
  legacyProceduresConceptUuids,
  useVisitNoteClinicalContext,
} from "./visit-notes.resource";

vi.mock("@openmrs/esm-framework", async () => ({
  ...(await vi.importActual("@openmrs/esm-framework")),
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig);

function buildEncounter(
  patientUuid: string,
  obs: Array<{ conceptUuid: string; value: string; formFieldPath?: string }>,
  options: {
    encounterDatetime?: string;
    encounterTypeUuid?: string;
    formUuid?: string;
    uuid?: string;
    visitUuid?: string;
  } = {},
) {
  return {
    uuid: options.uuid ?? "encounter-1",
    display: "Consulta externa",
    encounterDatetime:
      options.encounterDatetime ?? "2026-07-01T10:00:00.000+0000",
    encounterType: options.encounterTypeUuid
      ? { uuid: options.encounterTypeUuid }
      : undefined,
    form: options.formUuid ? { uuid: options.formUuid } : undefined,
    patient: { uuid: patientUuid },
    visit: options.visitUuid ? { uuid: options.visitUuid } : undefined,
    obs: obs.map((observation, index) => ({
      uuid: `obs-${index}`,
      obsDatetime: "2026-07-01T10:00:00.000+0000",
      display: observation.value,
      concept: { uuid: observation.conceptUuid, display: "concept" },
      value: observation.value,
      formFieldPath: observation.formFieldPath,
      formFieldNamespace: observation.formFieldPath ? "visit-notes" : undefined,
    })),
  };
}

describe("useVisitNoteClinicalContext procedures fallback", () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({} as ConfigObject);
  });

  it("reads procedures stored under the legacy dedicated concept without form field path", async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          buildEncounter("patient-legacy-procedure", [
            {
              conceptUuid: legacyProceduresConceptUuids.procedure,
              value: "Curación de herida",
            },
          ]),
        ],
      },
    } as never);

    const { result } = renderHook(() =>
      useVisitNoteClinicalContext("patient-legacy-procedure"),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.clinicalContext.procedures).toBe(
      "Curación de herida",
    );
  });

  it("reads the shared free-text concept only when it carries the procedures form field path", async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          buildEncounter("patient-shared-concept", [
            // SOAP plan stored under the same shared concept, but with another path:
            // it must NOT bleed into procedures.
            {
              conceptUuid: legacyProceduresConceptUuids.textWithProceduresPath,
              value: "Plan: reposo",
              formFieldPath: "soap-plan",
            },
            {
              conceptUuid: legacyProceduresConceptUuids.textWithProceduresPath,
              value: "Sutura simple",
              formFieldPath: "procedures",
            },
          ]),
        ],
      },
    } as never);

    const { result } = renderHook(() =>
      useVisitNoteClinicalContext("patient-shared-concept"),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.clinicalContext.procedures).toBe("Sutura simple");
    expect(result.current.clinicalContext.plan).toBe("Plan: reposo");
  });

  it("prefers the current procedures concept over legacy fallbacks", async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          buildEncounter("patient-current-concept", [
            {
              conceptUuid: legacyProceduresConceptUuids.procedure,
              value: "Procedimiento antiguo",
            },
            {
              conceptUuid:
                defaultVisitNoteClinicalConceptUuids.proceduresConceptUuid,
              value: "Procedimiento actual",
              formFieldPath: "procedures",
            },
          ]),
        ],
      },
    } as never);

    const { result } = renderHook(() =>
      useVisitNoteClinicalContext("patient-current-concept"),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.clinicalContext.procedures).toBe(
      "Procedimiento actual",
    );
  });

  it("excludes the visit-note encounter so outpatient care remains the summary source", async () => {
    const patientUuid = "patient-read-only-summary";
    const visitUuid = "visit-1";
    const visitNoteEncounterTypeUuid = "visit-note-encounter-type";
    const visitNoteFormUuid = "visit-note-form";
    mockUseConfig.mockReturnValue({
      visitNoteConfig: {
        ...defaultVisitNoteClinicalConceptUuids,
        encounterTypeUuid: visitNoteEncounterTypeUuid,
        formConceptUuid: visitNoteFormUuid,
      },
    } as ConfigObject);
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          buildEncounter(
            patientUuid,
            [
              {
                conceptUuid:
                  defaultVisitNoteClinicalConceptUuids.chiefComplaintConceptUuid,
                value: "Copy edited in visit notes",
              },
            ],
            {
              encounterDatetime: "2026-07-01T11:00:00.000+0000",
              encounterTypeUuid: visitNoteEncounterTypeUuid,
              formUuid: visitNoteFormUuid,
              uuid: "visit-note-encounter",
              visitUuid,
            },
          ),
          buildEncounter(
            patientUuid,
            [
              {
                conceptUuid:
                  defaultVisitNoteClinicalConceptUuids.chiefComplaintConceptUuid,
                value: "Original outpatient complaint",
              },
            ],
            {
              encounterDatetime: "2026-07-01T10:00:00.000+0000",
              encounterTypeUuid: "outpatient-encounter-type",
              formUuid: "outpatient-form",
              uuid: "outpatient-encounter",
              visitUuid,
            },
          ),
        ],
      },
    } as never);

    const { result } = renderHook(() =>
      useVisitNoteClinicalContext(patientUuid, visitUuid),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.clinicalContext.chiefComplaint).toBe(
      "Original outpatient complaint",
    );
  });
});
