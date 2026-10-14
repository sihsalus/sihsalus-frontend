export const demographicDimensions = [
  "age",
  "sex",
  "disease",
  "ageGroup",
  "ethnicity",
  "pregnancy",
  "period",
] as const;
export type DemographicDimension = (typeof demographicDimensions)[number];
export interface AgeGroup {
  key: string;
  minAge: number;
  maxAge: number | null;
}
export interface DemographicReport {
  row: DemographicDimension;
  column: DemographicDimension;
  period: string;
  zoneLevel?: "DISTRITO" | "CENTRO_POBLADO";
  address?: string | null;
  from: string;
  to: string;
  generatedAt: string;
  rows: { key: string; label: string }[];
  columns: { key: string; label: string }[];
  values: number[][];
  rowTotals: number[];
  columnTotals: number[];
  total: number;
  excludedWithoutOnset: number;
  ageGroups: AgeGroup[];
}
