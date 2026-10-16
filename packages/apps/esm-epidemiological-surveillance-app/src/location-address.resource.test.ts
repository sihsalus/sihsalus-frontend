import { beforeEach, expect, it, vi } from "vitest";
import { addressChildren, read } from "./api";
import { locationAddressDefaults } from "./location-address.resource";
vi.mock("./api", () => ({ read: vi.fn(), addressChildren: vi.fn() }));
vi.mock("@openmrs/esm-framework", () => ({ restBaseUrl: "/ws/rest/v1" }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(addressChildren).mockImplementation(async (level) => [
    { uuid: level, display: level },
  ]);
});
it("inherits a child location's address and resolves each level under its parent", async () => {
  vi.mocked(read)
    .mockResolvedValueOnce({ parentLocation: { uuid: "parent" } })
    .mockResolvedValueOnce({
      address1: "departments",
      stateProvince: "provinces",
      countyDistrict: "districts",
      cityVillage: "populated-centers",
    });
  const result = await locationAddressDefaults(
    "child",
    true,
    new AbortController().signal,
  );
  expect(result.selected).toEqual([
    "departments",
    "provinces",
    "districts",
    "populated-centers",
  ]);
  expect(addressChildren).toHaveBeenCalledWith("provinces", "departments");
  expect(addressChildren).toHaveBeenCalledWith("districts", "provinces");
  expect(addressChildren).toHaveBeenCalledWith(
    "populated-centers",
    "districts",
  );
});
it("stops at missing or ambiguous hierarchy entries", async () => {
  vi.mocked(read).mockResolvedValue({
    address1: "departments",
    stateProvince: "provinces",
  });
  vi.mocked(addressChildren)
    .mockResolvedValueOnce([{ uuid: "dep", display: "departments" }])
    .mockResolvedValueOnce([
      { uuid: "one", display: "provinces" },
      { uuid: "two", display: "provinces" },
    ]);
  expect(
    (
      await locationAddressDefaults(
        "location",
        true,
        new AbortController().signal,
      )
    ).selected,
  ).toEqual(["dep", "", "", ""]);
});
it("handles locations without addresses and cyclic parent relationships", async () => {
  vi.mocked(read).mockResolvedValue({ parentLocation: { uuid: "location" } });
  expect(
    (
      await locationAddressDefaults(
        "location",
        true,
        new AbortController().signal,
      )
    ).selected,
  ).toEqual(["", "", "", ""]);
  expect(read).toHaveBeenCalledTimes(1);
  expect(addressChildren).not.toHaveBeenCalled();
});
