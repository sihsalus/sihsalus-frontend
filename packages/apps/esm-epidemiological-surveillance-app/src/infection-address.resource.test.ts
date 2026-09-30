import { openmrsFetch } from "@openmrs/esm-framework";
import { beforeEach, expect, it, vi } from "vitest";
import { searchInfectionAddresses } from "./infection-address.resource";
vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
}));
const province = { uuid: "p", name: "Province" };
const district = { uuid: "d", name: "District", parent: province };
const center = {
  uuid: "c",
  name: "Center",
  userGeneratedId: "1601010001",
  parent: district,
};
beforeEach(() => vi.resetAllMocks());
it.each(["Center", "District", "Province"])(
  "finds centers by %s and deduplicates results",
  async (term) => {
    vi.mocked(openmrsFetch).mockImplementation(async (url) => {
      const query = new URL(String(url), "http://localhost").searchParams;
      const field = query.get("addressField");
      const parent = query.get("parentUuid");
      const data =
        field === "cityVillage" && (term === "Center" || parent === "d")
          ? [center]
          : field === "countyDistrict" &&
              (term === "District" || parent === "p")
            ? [district]
            : field === "stateProvince" && term === "Province"
              ? [province]
              : [];
      return { data } as never;
    });
    expect(await searchInfectionAddresses(term)).toEqual([
      { uuid: "c", display: "Province → District → Center (1601010001)" },
    ]);
  },
);
it("finds by center code using its district code and retains leading zeros", async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: [{ ...center, userGeneratedId: "0101010001" }, center],
  } as never);
  expect(await searchInfectionAddresses("0101010001")).toEqual([
    { uuid: "c", display: "Province → District → Center (0101010001)" },
  ]);
  expect(openmrsFetch).toHaveBeenLastCalledWith(
    expect.stringContaining("userGeneratedIdForParent=010101"),
    expect.any(Object),
  );
});
it("does not search empty input and does not invent missing codes", async () => {
  expect(await searchInfectionAddresses("")).toEqual([]);
  expect(openmrsFetch).not.toHaveBeenCalled();
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: [{ ...center, userGeneratedId: undefined }],
  } as never);
  await expect(searchInfectionAddresses("Center")).rejects.toThrow();
});
it("rejects malformed or truncated results instead of silently claiming completeness", async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({ data: {} } as never);
  await expect(searchInfectionAddresses("Center")).rejects.toThrow();
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: Array(1000).fill(center),
  } as never);
  await expect(searchInfectionAddresses("Center")).rejects.toMatchObject({
    code: "ADDRESS_SEARCH_TOO_BROAD",
  });
});
