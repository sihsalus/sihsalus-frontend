import { openmrsFetch } from "@openmrs/esm-framework";
import { expect, it, vi } from "vitest";
import { searchInfectionAddresses } from "./infection-address.resource";
vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
}));
const province = {
  uuid: "p",
  name: "Province",
  parent: { uuid: "region", name: "Region" },
};
const district = { uuid: "d", name: "District", parent: province };
it("uses the registration endpoint with encoded parent and query, preserving center UUID and path", async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: [{ uuid: "c", name: "Center", parent: district }],
  } as never);
  expect(await searchInfectionAddresses("cityVillage", "d", "A&B")).toEqual([
    { uuid: "c", display: "Province → District → Center" },
  ]);
  expect(openmrsFetch).toHaveBeenLastCalledWith(
    "/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?addressField=cityVillage&limit=20&searchString=A%26B&parentUuid=d",
    expect.any(Object),
  );
});
it("loads provinces without a parent and rejects mismatched parent or malformed response", async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({ data: [province] } as never);
  expect(await searchInfectionAddresses("stateProvince", "", "")).toEqual([
    { uuid: "p", display: "Province" },
  ]);
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: [{ uuid: "c", name: "Center", parent: district }],
  } as never);
  await expect(
    searchInfectionAddresses("cityVillage", "wrong", ""),
  ).rejects.toThrow();
  vi.mocked(openmrsFetch).mockResolvedValue({ data: {} } as never);
  await expect(
    searchInfectionAddresses("cityVillage", "d", ""),
  ).rejects.toThrow();
});
