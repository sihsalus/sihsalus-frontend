import { beforeEach, expect, it, vi } from "vitest";
import { openmrsFetch } from "@openmrs/esm-framework";
import { getDemographics, saveAgeGroups } from "./demographic.resource";
import type { AgeGroup } from "./demographic.types";
vi.mock("@openmrs/esm-framework", () => ({
  restBaseUrl: "/ws/rest/v1",
  openmrsFetch: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("sends comparison filters and preserves the abort signal", async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { total: 2 } } as never);
  const signal = new AbortController().signal;
  await getDemographics(
    { row: "disease", column: "period", compareEvents: "a,b", period: "anio" },
    signal,
  );
  expect(openmrsFetch).toHaveBeenCalledWith(
    expect.stringContaining("compareEvents=a%2Cb"),
    expect.objectContaining({ signal }),
  );
});
it("sends edited groups as a JSON array that the API can decode", async () => {
  const groups: AgeGroup[] = [
    { key: "INFANTS", minAge: 0, maxAge: 2 },
    { key: "CHILDREN", minAge: 3, maxAge: 11 },
    { key: "ADOLESCENTS", minAge: 12, maxAge: 17 },
    { key: "YOUNG_ADULTS", minAge: 18, maxAge: 29 },
    { key: "ADULTS", minAge: 30, maxAge: 59 },
    { key: "OLDER_ADULTS", minAge: 60, maxAge: null },
  ];
  vi.mocked(openmrsFetch).mockResolvedValue({ data: groups } as never);

  await expect(saveAgeGroups(groups)).resolves.toEqual(groups);

  const [url, options] = vi.mocked(openmrsFetch).mock.calls[0];
  expect(url).toContain("/configuration/age-groups");
  expect(options).toMatchObject({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });
  expect(typeof options.body).toBe("string");
  // Exercise the browser's body encoding, including the unbounded final group.
  const request = new Request("https://example.test/age-groups", {
    method: "PUT",
    body: options.body as string,
  });
  expect(await request.json()).toEqual(groups);
});
it("exposes safe validation messages when saving groups fails", async () => {
  vi.mocked(openmrsFetch).mockRejectedValue({
    status: 422,
    responseBody: { code: "INVALID_AGE_GROUPS" },
  });
  await expect(saveAgeGroups([])).rejects.toMatchObject({
    code: "INVALID_AGE_GROUPS",
    status: 422,
  });
  expect(openmrsFetch).toHaveBeenCalledWith(
    expect.stringContaining("/configuration/age-groups"),
    expect.objectContaining({ method: "PUT", body: "[]" }),
  );
});
