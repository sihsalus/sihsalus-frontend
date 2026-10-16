import { beforeEach, expect, it, vi } from "vitest";
import { openmrsFetch } from "@openmrs/esm-framework";
import {
  getGeography,
  importCoordinates,
  saveRiskThresholds,
} from "./geographic.resource";
vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
}));
beforeEach(() => vi.clearAllMocks());
it("serializes threshold arrays and CSV text as JSON", async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({ data: [10, 20, 50] } as never);
  await saveRiskThresholds([10, 20, 50]);
  const request = vi.mocked(openmrsFetch).mock.calls[0][1];
  expect(JSON.parse(String(request?.body))).toEqual([10, 20, 50]);
  const csv = "address_hierarchy_entry_id,latitude,longitude\r\n001,-3,-73";
  await importCoordinates(csv);
  expect(
    JSON.parse(String(vi.mocked(openmrsFetch).mock.calls[1][1]?.body)),
  ).toEqual({ csv });
});
it("passes dates, geography and cancellation to the aggregate endpoint", async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { total: 0 } } as never);
  const controller = new AbortController();
  await getGeography(
    {
      event: "synthetic",
      from: "2026-01-01",
      to: "2026-02-01",
      zoneLevel: "DISTRITO",
      address: "district",
    },
    controller.signal,
  );
  expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toContain(
    "reports/geography?",
  );
  expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toContain(
    "zoneLevel=DISTRITO&address=district",
  );
  expect(vi.mocked(openmrsFetch).mock.calls[0][1]?.signal).toBe(
    controller.signal,
  );
});
