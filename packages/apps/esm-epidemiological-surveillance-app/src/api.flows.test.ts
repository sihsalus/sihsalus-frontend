import { openmrsFetch } from "@openmrs/esm-framework";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addressChildren,
  attendAlert,
  createSurveillanceCase,
  encountersForPatient,
  getAlerts,
  getEncounterObservations,
  getEvents,
  listSurveillanceCases,
  localPage,
  saveEvent,
  updateEvent,
  updateSurveillanceCase,
} from "./api";
import type { SurveillanceCaseDraft } from "./types";

vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
}));

const rejected = { status: 422, responseBody: { code: "INVALID_REFERENCE" } };

describe("surveillance API writes and pagination", () => {
  beforeEach(() => vi.mocked(openmrsFetch).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("announces generated alerts after creating or updating a case and maps failures", async () => {
    const announced: unknown[] = [];
    const listener = (event: Event) => announced.push((event as CustomEvent).detail);
    window.addEventListener("surveillance-alerts-generated", listener);
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: { uuid: "case", generatedAlerts: [{ uuid: "alert" }] } } as never)
      .mockResolvedValueOnce({ data: { uuid: "case" } } as never)
      .mockRejectedValueOnce(rejected)
      .mockRejectedValueOnce(rejected);
    const draft = {} as SurveillanceCaseDraft;
    await expect(createSurveillanceCase(draft)).resolves.toMatchObject({ uuid: "case" });
    await expect(updateSurveillanceCase("case/1", draft)).resolves.toMatchObject({ uuid: "case" });
    expect(announced).toEqual([[{ uuid: "alert" }], []]);
    expect(String(vi.mocked(openmrsFetch).mock.calls[1][0])).toContain("/cases/case%2F1");
    await expect(createSurveillanceCase(draft)).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
    await expect(updateSurveillanceCase("case", draft)).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
    window.removeEventListener("surveillance-alerts-generated", listener);
  });

  it("reads cases, events and alerts with their filters and attends alerts", async () => {
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: { results: [{ uuid: "case" }] } } as never)
      .mockResolvedValueOnce({ data: { results: [{ uuid: "event" }] } } as never)
      .mockResolvedValueOnce({ data: [{ uuid: "alert" }] } as never)
      .mockResolvedValueOnce({ data: { uuid: "alert", status: "ATTENDED" } } as never)
      .mockRejectedValueOnce(rejected);
    await expect(listSurveillanceCases({ patient: "p" })).resolves.toEqual([{ uuid: "case" }]);
    await expect(getEvents(true)).resolves.toEqual([{ uuid: "event" }]);
    await expect(getAlerts({ status: "PENDING" })).resolves.toEqual([{ uuid: "alert" }]);
    await expect(attendAlert("alert")).resolves.toMatchObject({ status: "ATTENDED" });
    await expect(attendAlert("alert")).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
    const urls = vi.mocked(openmrsFetch).mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toContain("/cases?patient=p");
    expect(urls[1]).toContain("/events?includeRetired=true");
    expect(urls[2]).toContain("/alerts?status=PENDING");
    expect(urls[3]).toContain("/alerts/alert/attend");
  });

  it("saves and updates notifiable events and maps failures", async () => {
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: { uuid: "event" } } as never)
      .mockRejectedValueOnce(rejected)
      .mockRejectedValueOnce(rejected);
    await expect(saveEvent({ conceptUuid: "concept" })).resolves.toEqual({ uuid: "event" });
    await expect(saveEvent({ conceptUuid: "concept" })).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
    await expect(updateEvent("event", {} as never)).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
  });

  it("follows only same-origin pages under the REST path and stops on repeated links", async () => {
    const origin = globalThis.location.origin;
    expect(localPage(`${origin}/openmrs/ws/rest/v1/encounter?startIndex=100`, "/ws/rest/v1")).toBe(
      "/ws/rest/v1/encounter?startIndex=100",
    );
    expect(() => localPage("https://elsewhere.example/openmrs/ws/rest/v1/encounter", "/ws/rest/v1")).toThrow();
    expect(() => localPage(`${origin}/openmrs/ws/other/encounter`, "/ws/rest/v1")).toThrow();
    const next = `${origin}/openmrs/ws/rest/v1/encounter?patient=patient&startIndex=100`;
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: { results: [], links: [{ rel: "next", uri: next }] } } as never)
      .mockResolvedValueOnce({ data: { results: [], links: [{ rel: "next", uri: next }] } } as never);
    await expect(encountersForPatient("patient")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("rejects observations from an encounter of another patient", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: { uuid: "encounter", patient: { uuid: "another" }, obs: [] },
    } as never);
    await expect(getEncounterObservations("encounter", "patient")).rejects.toMatchObject({
      code: "INVALID_SOURCE_ENCOUNTER",
    });
  });

  it("lists address levels with and without a parent", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { results: [{ uuid: "loreto", display: "Loreto" }] } } as never);
    await expect(addressChildren("departments")).resolves.toEqual([{ uuid: "loreto", display: "Loreto" }]);
    await addressChildren("provinces", "lo reto");
    expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toMatch(/\/addresses\/departments$/);
    expect(vi.mocked(openmrsFetch).mock.calls[1][0]).toMatch(/\/addresses\/provinces\?parent=lo%20reto$/);
  });
});
