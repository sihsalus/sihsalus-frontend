import { openmrsFetch } from "@openmrs/esm-framework";
import { apiBase, read, safeError } from "./api";
import type { AgeGroup, DemographicReport } from "./demographic.types";

export const getAgeGroups = (signal?: AbortSignal) =>
  read<AgeGroup[]>(`${apiBase}/configuration/age-groups`, signal);
export async function saveAgeGroups(groups: AgeGroup[]): Promise<AgeGroup[]> {
  try {
    return (
      await openmrsFetch<AgeGroup[]>(`${apiBase}/configuration/age-groups`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // openmrsFetch only serializes plain objects, not arrays.
        body: JSON.stringify(groups),
      })
    ).data;
  } catch (error) {
    throw safeError(error);
  }
}
export const getDemographics = (
  filters: Record<string, string>,
  signal?: AbortSignal,
) =>
  read<DemographicReport>(
    `${apiBase}/reports/demographics?${new URLSearchParams(filters)}`,
    signal,
  );
