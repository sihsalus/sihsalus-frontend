import type {
  DemographicDimension,
  DemographicReport,
} from "./demographic.types";
import { openmrsFetch } from "@openmrs/esm-framework";
import { apiBase, read, safeError } from "./api";

export interface GeographicFocus {
  centerId: number;
  label: string;
  total: number;
  latitude: number | null;
  longitude: number | null;
  lastAutochthonousYear: number | null;
  classification: "ACTIVE" | "RESIDUAL" | "ELIMINATED" | "UNCLASSIFIED";
  risk: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  origins: Record<string, number>;
}
export type GeographicColumn =
  Exclude<DemographicDimension, "disease"> | "origin";
export interface GeographicReport {
  table?: Omit<DemographicReport, "row" | "column"> & {
    row: "center";
    column: GeographicColumn;
  };
  from: string;
  to: string;
  referenceYear: number;
  total: number;
  unmappedCases: number;
  riskThresholds: number[];
  foci: GeographicFocus[];
}
export const geographicOrigins = [
  "AUTOCTONO",
  "IMPORTADO_NACIONAL",
  "IMPORTADO_INTERNACIONAL",
  "RECAIDA",
  "RECRUDESCENCIA",
  "INDUCIDO",
  "INTRODUCIDO",
  "UNKNOWN",
];
export const getGeography = (
  filters: Record<string, string>,
  signal?: AbortSignal,
) =>
  read<GeographicReport>(
    `${apiBase}/reports/geography?${new URLSearchParams(filters)}`,
    signal,
  );
export const getRiskThresholds = (signal?: AbortSignal) =>
  read<number[]>(`${apiBase}/configuration/risk-levels`, signal);
async function save<T>(path: string, body: unknown): Promise<T> {
  try {
    return (
      await openmrsFetch<T>(`${apiBase}/configuration/${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ).data;
  } catch (error) {
    throw safeError(error);
  }
}
export const saveRiskThresholds = (bounds: number[]) =>
  save<number[]>("risk-levels", bounds);
export const importCoordinates = (csv: string) =>
  save<{ imported: number; matched?: number; pending?: number }>(
    "coordinates",
    { csv },
  );
export const validRiskThresholds = (bounds: string[]) =>
  bounds.length === 3 &&
  bounds.every(
    (value, i) =>
      /^\d+$/.test(value) &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) <= 2147483647 &&
      Number(value) > (i === 0 ? 1 : Number(bounds[i - 1])),
  );
