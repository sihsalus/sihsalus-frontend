import { openmrsFetch, useConfig } from "@openmrs/esm-framework";
import { renderHook } from "@testing-library/react";
import useSWR from "swr";
import type { ConfigObject } from "../config-schema";
import {
  assertCanonicalVisitNoteCanBeCreated,
  useCanonicalVisitNoteEncounter,
  useVisitNotes,
} from "./visit-notes.resource";

vi.mock("@openmrs/esm-framework", async () => ({
  ...(await vi.importActual("@openmrs/esm-framework")),
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(),
}));

vi.mock("swr", () => ({
  default: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseSWR = vi.mocked(useSWR);

const encounterTypeUuid = "d7151f82-c1f3-4152-a605-2f9ea7414a79";
const formUuid = "c75f120a-04ec-11e3-8780-2b40bef9a44b";

describe("useVisitNotes", () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      visitNoteConfig: {
        encounterNoteTextConceptUuid: "note-concept-uuid",
        encounterTypeUuid,
        formConceptUuid: formUuid,
      },
    } as ConfigObject);
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);
  });

  it("queries the canonical encounter type and form instead of requiring a legacy diagnosis observation", () => {
    renderHook(() => useVisitNotes("patient-uuid"));

    const [key] = mockUseSWR.mock.calls[0];
    const url = new URL(key as string, "https://openmrs.test");

    expect(url.searchParams.get("patient")).toBe("patient-uuid");
    expect(url.searchParams.get("encounterType")).toBe(encounterTypeUuid);
    expect(url.searchParams.get("form")).toBe(formUuid);
    expect(url.searchParams.has("obs")).toBe(false);
  });

  it("does not issue an unscoped encounter query without a patient UUID", () => {
    renderHook(() => useVisitNotes(""));

    expect(mockUseSWR.mock.calls[0][0]).toBeNull();
  });

  it("lists a structured diagnosis even when the legacy diagnosis observation is absent", () => {
    mockUseSWR.mockReturnValue({
      data: {
        data: {
          results: [
            {
              uuid: "encounter-uuid",
              display: "Visit Note",
              encounterDatetime: "2026-08-23T10:00:00.000-0500",
              encounterType: { uuid: encounterTypeUuid, name: "Visit Note" },
              encounterProviders: [],
              obs: [],
              diagnoses: [
                { display: "J00 - Rinofaringitis aguda", voided: false },
              ],
            },
          ],
        },
      },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() => useVisitNotes("patient-uuid"));

    expect(result.current.visitNotes).toHaveLength(1);
    expect(result.current.visitNotes?.[0].diagnoses).toBe(
      "J00 - Rinofaringitis aguda",
    );
  });
});

describe("useCanonicalVisitNoteEncounter", () => {
  const patientUuid = "patient-uuid";
  const visitUuid = "visit-uuid";
  const matchingEncounter = {
    uuid: "encounter-uuid",
    encounterDatetime: "2026-08-23T10:00:00.000-0500",
    patient: { uuid: patientUuid },
    visit: { uuid: visitUuid },
    encounterType: { uuid: encounterTypeUuid },
    form: { uuid: formUuid },
    location: { uuid: "location-uuid" },
    encounterProviders: [
      {
        uuid: "encounter-provider-uuid",
        encounterRole: { uuid: "encounter-role-uuid" },
        provider: { uuid: "provider-uuid" },
      },
    ],
    obs: [],
    diagnoses: [],
  };

  beforeEach(() => {
    mockUseSWR.mockReturnValue({
      data: { data: { results: [] } },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);
  });

  it("resolves zero matches as a canonical create", () => {
    const { result } = renderHook(() =>
      useCanonicalVisitNoteEncounter(
        patientUuid,
        visitUuid,
        encounterTypeUuid,
        formUuid,
      ),
    );

    expect(result.current).toMatchObject({ status: "ready", encounter: null });
    const url = new URL(
      mockUseSWR.mock.calls[0][0] as string,
      "https://openmrs.test",
    );
    expect(url.searchParams.get("patient")).toBe(patientUuid);
    expect(url.searchParams.get("visit")).toBe(visitUuid);
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("resolves one fully verified match as the canonical edit", () => {
    mockUseSWR.mockReturnValue({
      data: { data: { results: [matchingEncounter] } },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() =>
      useCanonicalVisitNoteEncounter(
        patientUuid,
        visitUuid,
        encounterTypeUuid,
        formUuid,
      ),
    );

    expect(result.current).toMatchObject({
      status: "ready",
      encounter: matchingEncounter,
    });
  });

  it("keeps verified stale data ready during background revalidation", () => {
    mockUseSWR.mockReturnValue({
      data: { data: { results: [matchingEncounter] } },
      error: undefined,
      isLoading: false,
      isValidating: true,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() =>
      useCanonicalVisitNoteEncounter(
        patientUuid,
        visitUuid,
        encounterTypeUuid,
        formUuid,
      ),
    );

    expect(result.current).toMatchObject({
      status: "ready",
      encounter: matchingEncounter,
    });
  });

  it("fails closed when a returned encounter has a different identity", () => {
    mockUseSWR.mockReturnValue({
      data: {
        data: {
          results: [
            { ...matchingEncounter, patient: { uuid: "other-patient" } },
          ],
        },
      },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() =>
      useCanonicalVisitNoteEncounter(
        patientUuid,
        visitUuid,
        encounterTypeUuid,
        formUuid,
      ),
    );

    expect(result.current).toMatchObject({ status: "error", encounter: null });
  });

  it.each([
    ["location", { location: undefined }],
    [
      "provider",
      {
        encounterProviders: [
          { uuid: "provider-link", provider: {}, encounterRole: {} },
        ],
      },
    ],
    ["observations", { obs: [{ uuid: "obs-uuid", concept: undefined }] }],
    [
      "diagnoses",
      {
        diagnoses: [
          { uuid: "diagnosis-uuid", diagnosis: { coded: undefined } },
        ],
      },
    ],
  ])(
    "fails closed when the canonical encounter has incomplete %s data",
    (_field, incompletePart) => {
      mockUseSWR.mockReturnValue({
        data: {
          data: { results: [{ ...matchingEncounter, ...incompletePart }] },
        },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      } as never);

      const { result } = renderHook(() =>
        useCanonicalVisitNoteEncounter(
          patientUuid,
          visitUuid,
          encounterTypeUuid,
          formUuid,
        ),
      );

      expect(result.current).toMatchObject({
        status: "error",
        encounter: null,
      });
    },
  );

  it("fails closed when more than one canonical match exists", () => {
    mockUseSWR.mockReturnValue({
      data: {
        data: {
          results: [
            matchingEncounter,
            { ...matchingEncounter, uuid: "encounter-uuid-2" },
          ],
        },
      },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() =>
      useCanonicalVisitNoteEncounter(
        patientUuid,
        visitUuid,
        encounterTypeUuid,
        formUuid,
      ),
    );

    expect(result.current).toMatchObject({
      status: "ambiguous",
      encounter: null,
    });
  });
});

describe("assertCanonicalVisitNoteCanBeCreated", () => {
  it("allows creation only when the immediate authoritative lookup is empty", async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as never);

    await expect(
      assertCanonicalVisitNoteCanBeCreated(
        "patient-uuid",
        "visit-uuid",
        encounterTypeUuid,
        formUuid,
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks a stale create when another canonical summary now exists", async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { results: [{ uuid: "existing-encounter" }] },
    } as never);

    await expect(
      assertCanonicalVisitNoteCanBeCreated(
        "patient-uuid",
        "visit-uuid",
        encounterTypeUuid,
        formUuid,
      ),
    ).rejects.toThrow(/already exists|could not be verified/i);
  });
});
