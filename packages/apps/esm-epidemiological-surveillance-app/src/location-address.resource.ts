import { restBaseUrl } from "@openmrs/esm-framework";
import { addressChildren, read } from "./api";
import type { NamedReference } from "./types";

interface LocationAddress {
  address1?: string;
  stateProvince?: string;
  countyDistrict?: string;
  cityVillage?: string;
  parentLocation?: { uuid: string };
}

/** Resolve names only within their selected parent; never guess ambiguous territorial entries. */
export async function locationAddressDefaults(
  uuid: string,
  includeCenter: boolean,
  signal: AbortSignal,
) {
  const fields = [
    "address1",
    "stateProvince",
    "countyDistrict",
    "cityVillage",
  ] as const;
  const names = ["", "", "", ""];
  const visited = new Set<string>();
  let current: string | undefined = uuid;
  while (current && !visited.has(current) && names.some((name) => !name)) {
    visited.add(current);
    const location: LocationAddress = await read(
      `${restBaseUrl}/location/${encodeURIComponent(current)}?v=custom:(address1,stateProvince,countyDistrict,cityVillage,parentLocation:(uuid))`,
      signal,
    );
    fields.forEach((field, index) => {
      names[index] ||= location[field]?.trim() ?? "";
    });
    current = location.parentLocation?.uuid;
  }
  const selected = ["", "", "", ""];
  const options: NamedReference[][] = [[], [], [], []];
  const levels = [
    "departments",
    "provinces",
    "districts",
    "populated-centers",
  ] as const;
  const normalize = (name: string) =>
    name
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleUpperCase("es");
  for (let index = 0; index < (includeCenter ? 4 : 3); index++) {
    if (signal.aborted || !names[index]) break;
    options[index] = await addressChildren(
      levels[index],
      index ? selected[index - 1] : undefined,
    );
    const matches = options[index].filter(
      (entry) => normalize(entry.display) === normalize(names[index]),
    );
    if (matches.length !== 1) break;
    selected[index] = matches[0].uuid;
  }
  return { selected, options };
}
