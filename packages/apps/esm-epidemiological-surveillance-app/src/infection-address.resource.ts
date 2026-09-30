import { read, SurveillanceApiError } from "./api";
import type { NamedReference } from "./types";

interface HierarchyEntry {
  uuid: string;
  name: string;
  userGeneratedId?: string;
  parent?: HierarchyEntry;
}

/** Native Address Hierarchy contract, as used by patient-registration. */
export async function searchInfectionAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<NamedReference[]> {
  const term = query.trim();
  if (term.length < 3) return [];
  let requests = 0;
  async function entries(
    addressField: string,
    searchString: string,
    parentUuid = "",
    parentCode?: string,
  ) {
    if (++requests > 50)
      throw new SurveillanceApiError("ADDRESS_SEARCH_TOO_BROAD", 0);
    const params = new URLSearchParams({
      addressField,
      limit: "1000",
      searchString,
      parentUuid,
    });
    if (parentCode) params.set("userGeneratedIdForParent", parentCode);
    const result = await read<HierarchyEntry[]>(
      `/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?${params}`,
      signal,
    );
    if (
      !Array.isArray(result) ||
      result.some((entry) => !entry?.uuid || typeof entry.name !== "string")
    )
      throw new SurveillanceApiError("SERVICE_UNAVAILABLE", 0);
    // Do not silently treat a truncated hierarchy as complete.
    if (result.length >= 1000)
      throw new SurveillanceApiError("ADDRESS_SEARCH_TOO_BROAD", 0);
    return result;
  }
  let centers: HierarchyEntry[];
  if (/^\d+$/.test(term)) {
    // As in registration, a populated-center UBIGEO extends the six-digit district code.
    if (term.length < 6) return [];
    centers = (await entries("cityVillage", "%", "", term.slice(0, 6))).filter(
      (entry) => entry.userGeneratedId?.startsWith(term),
    );
  } else {
    const [direct, districts, provinces] = await Promise.all([
      entries("cityVillage", term),
      entries("countyDistrict", term),
      entries("stateProvince", term),
    ]);
    const allDistricts = new Map(districts.map((entry) => [entry.uuid, entry]));
    for (const province of provinces) {
      for (const district of await entries(
        "countyDistrict",
        "%",
        province.uuid,
      ))
        allDistricts.set(district.uuid, district);
    }
    centers = [...direct];
    for (const district of allDistricts.values())
      centers.push(...(await entries("cityVillage", "%", district.uuid)));
  }
  return [
    ...new Map(
      centers.map((entry) => {
        const district = entry.parent;
        const province = district?.parent;
        if (!district?.name || !province?.name || !entry.userGeneratedId)
          throw new SurveillanceApiError("ADDRESS_METADATA_INCOMPLETE", 0);
        return [
          entry.uuid,
          {
            uuid: entry.uuid,
            display: `${province.name} → ${district.name} → ${entry.name} (${entry.userGeneratedId})`,
          },
        ] as const;
      }),
    ).values(),
  ].sort((a, b) => a.display.localeCompare(b.display));
}
