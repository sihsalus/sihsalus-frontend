import { read, SurveillanceApiError } from "./api";
import type { NamedReference } from "./types";

export type InfectionAddressLevel =
  | "stateProvince"
  | "countyDistrict"
  | "cityVillage";
interface HierarchyEntry {
  uuid: string;
  name: string;
  parent?: HierarchyEntry;
}

/** Same Address Hierarchy AJAX contract used by patient-registration; retain UUIDs, not free text. */
export async function searchInfectionAddresses(
  level: InfectionAddressLevel,
  parent: string,
  query: string,
  signal?: AbortSignal,
): Promise<NamedReference[]> {
  const params = new URLSearchParams({
    addressField: level,
    limit: "20",
    searchString: query.trim() || "%",
    parentUuid: parent,
  });
  const entries = await read<HierarchyEntry[]>(
    `/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?${params}`,
    signal,
  );
  if (!Array.isArray(entries))
    throw new SurveillanceApiError("SERVICE_UNAVAILABLE", 0);
  return entries.map((entry) => {
    const path: HierarchyEntry[] = [];
    let current: HierarchyEntry | undefined = entry;
    const seen = new Set<string>();
    while (current) {
      if (
        !current.uuid ||
        typeof current.name !== "string" ||
        seen.has(current.uuid)
      )
        throw new SurveillanceApiError("SERVICE_UNAVAILABLE", 0);
      seen.add(current.uuid);
      path.unshift(current);
      current = current.parent;
    }
    const depth =
      level === "stateProvince" ? 1 : level === "countyDistrict" ? 2 : 3;
    if (path.length < depth || (parent && entry.parent?.uuid !== parent))
      throw new SurveillanceApiError("SERVICE_UNAVAILABLE", 0);
    return {
      uuid: entry.uuid,
      display: path
        .slice(-depth)
        .map((part) => part.name)
        .join(" → "),
    };
  });
}
